import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { identityConfig } from '../config/identity.config';

/**
 * Refresh token de la web en cookie HttpOnly (V2 §18).
 *
 * El navegador guarda el refresh token donde JavaScript no lo alcanza: un XSS
 * podría leer `localStorage`, no una cookie HttpOnly. El access token vive en
 * memoria y dura 15 minutos.
 *
 * Es opcional por petición: el cliente lo pide con la cabecera
 * `X-Session-Transport: cookie`. El móvil no la envía y sigue recibiendo el
 * refresh token en el cuerpo, que guarda en Expo SecureStore.
 */
export const REFRESH_COOKIE = 'afinia_rt';
export const SESSION_TRANSPORT_HEADER = 'x-session-transport';

export function wantsCookie(req: Request): boolean {
  return String(req.headers[SESSION_TRANSPORT_HEADER] ?? '').toLowerCase() === 'cookie';
}

export function readRefreshCookie(req: Request): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const parte of raw.split(';')) {
    const [nombre, ...resto] = parte.trim().split('=');
    if (nombre === REFRESH_COOKIE) {
      const valor = decodeURIComponent(resto.join('='));
      return valor || undefined;
    }
  }
  return undefined;
}

function cookieOptions(config: ConfigService) {
  const production = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
  const sameSiteRaw = (config.get<string>('REFRESH_COOKIE_SAMESITE') ?? 'lax').toLowerCase();
  const sameSite = (['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax') as
    'lax' | 'strict' | 'none';
  const secureEnv = config.get<string>('REFRESH_COOKIE_SECURE');
  // SameSite=None exige Secure; en producción siempre Secure.
  const secure = sameSite === 'none' || production || secureEnv === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite,
    // Solo viaja a las rutas de sesión, no a cada petición de la API.
    path: '/api/auth',
  };
}

export function setRefreshCookie(res: Response, token: string, config: ConfigService): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions(config),
    maxAge: identityConfig.refreshTokenTtlDays(config) * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response, config: ConfigService): void {
  res.clearCookie(REFRESH_COOKIE, cookieOptions(config));
}
