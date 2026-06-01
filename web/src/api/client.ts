import axios from 'axios';

const TOKEN_KEY = 'perfil_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export function apiError(error: unknown, fallback = 'Ocurrió un error.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor. Verifica que la API esté activa.';
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
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
