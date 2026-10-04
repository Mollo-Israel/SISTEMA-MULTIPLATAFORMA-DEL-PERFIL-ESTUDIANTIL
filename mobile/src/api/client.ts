import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';

const TOKEN_KEY = 'afinia_access';
const REFRESH_KEY = 'afinia_refresh';

/**
 * Almacen de sesion (§14).
 *
 * Ambos tokens viven en SecureStore, no en AsyncStorage: en Android quedan
 * cifrados con la clave del dispositivo, de modo que otra aplicacion no puede
 * leerlos. El access dura minutos; el refresh es el que de verdad importa y el
 * servidor puede revocarlo en cualquier momento.
 */
export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  setPair: async (access: string, refresh: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

/**
 * V2 §67: la app móvil es del Estudiante. Se identifica en cada pedido y la
 * API rechaza el inicio de sesión de otros roles desde aquí; personal docente,
 * dirección, sociedad y administración usan la web.
 */
export const CLIENT_HEADER = { 'X-Afinia-Client': 'mobile' };

export const api = axios.create({ baseURL: API_URL, headers: CLIENT_HEADER });

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

/**
 * Renovacion en curso.
 *
 * Una pantalla suele lanzar varias peticiones a la vez. Si el access acaba de
 * caducar, todas fallarian con 401 y cada una pediria su propio refresh; como
 * el refresh rota en cada canje, solo la primera funcionaria y el resto
 * cerraria la sesion. Compartiendo la promesa, solo se canjea una vez.
 */
let refreshing: Promise<string | null> | null = null;

async function renovarSesion(): Promise<string | null> {
  const refreshToken = await tokenStore.getRefresh();
  if (!refreshToken) return null;
  try {
    // Cliente limpio: si esta llamada pasara por los interceptores, un 401 en
    // la propia renovacion entraria en bucle.
    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { headers: CLIENT_HEADER });
    await tokenStore.setPair(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    await tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (typeof error.config & { _reintentado?: boolean });
    // Se excluyen login y refresh: reintentar un login fallido no tiene sentido,
    // y reintentar el propio refresh entraria en bucle. El resto —incluido
    // /auth/me al abrir la aplicacion— si debe poder renovar, o quien vuelva
    // con la sesion caducada saldria expulsado teniendo un refresh valido.
    const url = String(original?.url ?? '');
    const esRenovable =
      error.response?.status === 401
      && original
      && !original._reintentado
      && !url.includes('/auth/refresh')
      && !url.includes('/auth/login');

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
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      // Decir a donde se intento llegar ahorra la mitad del diagnostico:
      // casi siempre es que la API no esta levantada o que el telefono
      // esta en otra red que el equipo.
      return `No se pudo conectar con el servidor (${API_URL}). Verifique que la API esté levantada y que el teléfono esté en la misma red.`;
    }
  }
  return fallback;
}
