import axios from 'axios';

/**
 * Almacén de sesión (V2 §18).
 *
 * El access token vive **solo en memoria**: dura 15 minutos y una recarga lo
 * pierde, que es lo que se busca. El refresh token ni siquiera llega a
 * JavaScript: la API lo guarda en una cookie HttpOnly que el navegador envía
 * solo a `/api/auth`. En `localStorage` queda únicamente una marca sin valor
 * secreto («hay una sesión que intentar renovar»), para no pedir una
 * renovación inútil a quien nunca inició sesión.
 */
const SESSION_HINT = 'afinia_session';
let accessToken: string | null = null;

// Restos de la versión anterior, que guardaba los tokens en localStorage.
try {
  localStorage.removeItem('afinia_access');
  localStorage.removeItem('afinia_refresh');
} catch {
  /* almacenamiento no disponible */
}

export const tokenStore = {
  get: () => accessToken,
  set: (token: string) => {
    accessToken = token;
    try {
      localStorage.setItem(SESSION_HINT, '1');
    } catch {
      /* almacenamiento no disponible */
    }
  },
  hasSession: () => {
    try {
      return localStorage.getItem(SESSION_HINT) === '1';
    } catch {
      return false;
    }
  },
  clear: () => {
    accessToken = null;
    try {
      localStorage.removeItem(SESSION_HINT);
    } catch {
      /* almacenamiento no disponible */
    }
  },
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
});

/** Opciones de las llamadas de sesión: cookie HttpOnly en vez de token en el cuerpo. */
export const SESSION_REQUEST = {
  withCredentials: true,
  headers: { 'X-Session-Transport': 'cookie' },
} as const;

/**
 * Peticiones en curso. La barra de progreso superior se suscribe aqui, de modo
 * que refleja actividad real de red y no una animacion decorativa.
 */
type ActivityListener = (pending: number) => void;
let pendingRequests = 0;
const activityListeners = new Set<ActivityListener>();
const notifyActivity = () => activityListeners.forEach((listener) => listener(pendingRequests));

export const requestActivity = {
  subscribe(listener: ActivityListener) {
    activityListeners.add(listener);
    listener(pendingRequests);
    return () => {
      activityListeners.delete(listener);
    };
  },
};

const startRequest = () => {
  pendingRequests += 1;
  notifyActivity();
};
const endRequest = () => {
  pendingRequests = Math.max(0, pendingRequests - 1);
  notifyActivity();
};

api.interceptors.request.use(
  (config) => {
    startRequest();
    const token = tokenStore.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    endRequest();
    return Promise.reject(error);
  },
);

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

/**
 * Renovacion en curso.
 *
 * Si varias peticiones caducan a la vez, todas esperan al mismo canje. Sin
 * esto cada una pediria su propio refresh y, como el token rota, solo la
 * primera funcionaria: el resto cerraria la sesion del usuario.
 */
let refreshing: Promise<{ accessToken: string; user: unknown } | null> | null = null;

/** Canjea la cookie de sesión por un access token nuevo. */
export async function renovarSesion(): Promise<{ accessToken: string; user: unknown } | null> {
  if (!tokenStore.hasSession()) return null;
  try {
    // Cliente aparte: este no debe pasar por los interceptores, o un 401 en
    // la propia renovacion entraria en bucle.
    const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, SESSION_REQUEST);
    tokenStore.set(data.accessToken);
    return { accessToken: data.accessToken as string, user: data.user };
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => {
    endRequest();
    return response;
  },
  async (error) => {
    endRequest();

    const original = error.config as (typeof error.config & { _reintentado?: boolean });
    // Se excluyen login y refresh: reintentar un login fallido no tiene sentido,
    // y reintentar el propio refresh entraria en bucle. El resto —incluido
    // /auth/me al arrancar— si debe poder renovar, o quien vuelva con la sesion
    // caducada saldria expulsado teniendo un refresh perfectamente valido.
    const url = String(original?.url ?? '');
    const esRenovable =
      error.response?.status === 401
      && original
      && !original._reintentado
      && !url.includes('/auth/refresh')
      && !url.includes('/auth/login')
      && tokenStore.hasSession();

    if (esRenovable) {
      original._reintentado = true;
      refreshing = refreshing ?? renovarSesion();
      const nuevo = await refreshing;
      refreshing = null;
      if (nuevo) {
        // No hace falta tocar la cabecera: `api.request` vuelve a pasar por el
        // interceptor de peticion, que la rellena con el token ya renovado.
        return api.request(original);
      }
    }

    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export function apiError(error: unknown, fallback = 'Ocurrió un error.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor. Verifica que la API esté activa.';
    // Si la API detalló los errores, se muestran ellos y no el resumen: una
    // pantalla que no los coloca por campo al menos los dice todos.
    const details = error.response?.data?.details;
    if (Array.isArray(details) && details.length > 0) {
      return [...new Set(details.map(String))].join(' ');
    }
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

/**
 * Errores de un formulario, separados por campo.
 *
 * La API devuelve `fields: { campo: [mensajes] }`; cada formulario pone el
 * mensaje debajo de su casilla. Lo que no corresponde a ningún campo del
 * formulario queda en `general`, para un aviso arriba.
 */
export function formErrors(
  error: unknown,
  knownFields: string[] = [],
): { general: string | null; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  if (!axios.isAxiosError(error)) return { general: 'Ocurrió un error.', fields };
  if (!error.response) {
    return { general: 'No se pudo conectar con el servidor. Verifica que la API esté activa.', fields };
  }
  const data = error.response.data ?? {};
  const porCampo = data.fields as Record<string, string[]> | undefined;
  const sobrantes: string[] = [];
  if (porCampo && typeof porCampo === 'object') {
    for (const [campo, mensajes] of Object.entries(porCampo)) {
      const raiz = campo.split('.')[0];
      const texto = [...new Set((mensajes ?? []).map(String))].join(' ');
      if (knownFields.length === 0 || knownFields.includes(raiz)) fields[raiz] = texto;
      else sobrantes.push(texto);
    }
  }
  const tieneCampos = Object.keys(fields).length > 0;
  const general = tieneCampos
    ? sobrantes.join(' ') || null
    : apiError(error);
  return { general, fields };
}

// Mapea los mensajes de validación del backend a errores por campo (auth).
export function authFieldErrors(error: unknown): { message: string | null; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  if (!axios.isAxiosError(error)) return { message: 'Ocurrió un error.', fields };
  if (!error.response) {
    return { message: 'No se pudo conectar con el servidor. Verifica que la API esté activa.', fields };
  }
  const raw = error.response.data?.message;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  let banner: string | null = null;
  for (const msg of list) {
    const low = String(msg).toLowerCase();
    let key = '';
    if (low.includes('apellido')) key = 'lastName';
    else if (low.includes('nombre')) key = 'firstName';
    else if (low.includes('correo') || low.includes('email')) key = 'email';
    else if (low.includes('contraseña') || low.includes('password')) key = 'password';
    if (key) {
      if (!fields[key]) fields[key] = msg;
    } else {
      banner = banner ? `${banner} ${msg}` : msg;
    }
  }
  if (!list.length) banner = 'Ocurrió un error.';
  return { message: banner, fields };
}
