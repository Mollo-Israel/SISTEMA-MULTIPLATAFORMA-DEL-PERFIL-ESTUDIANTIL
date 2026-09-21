import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('IdentityConfig');

function num(config: ConfigService, key: string, fallback: number): number {
  const raw = config.get<string>(key);
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Limites de peticiones (§15, §100).
 *
 * Los valores por defecto son los de produccion. Se configuran por entorno
 * porque una suite de integracion hace decenas de inicios de sesion seguidos
 * desde la misma IP y quedaria bloqueada por su propio exito.
 */
export const rateLimits = {
  /** Peticiones por minuto y por IP contra cualquier endpoint. */
  global: (c: ConfigService) => num(c, 'RATE_LIMIT_GLOBAL_PER_MINUTE', 300),
};

/**
 * Limites estrechos de los endpoints sensibles.
 *
 * Se leen de `process.env` y no de ConfigService porque los decoradores de
 * @Throttle se evaluan al importar la clase, antes de que exista el contenedor
 * de inyeccion. `main.ts` carga el .env antes de importar la aplicacion para
 * que estos valores esten disponibles.
 */
const envNum = (key: string, fallback: number): number => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/** Login y refresh: objetivo natural de la fuerza bruta (§15). */
export const AUTH_RATE_LIMIT = { limit: envNum('RATE_LIMIT_AUTH_PER_MINUTE', 10), ttl: 60_000 };

/** Activacion y recuperacion: ademas evitan el envio masivo de correo (§15). */
export const ACTIVATION_RATE_LIMIT = {
  limit: envNum('RATE_LIMIT_ACTIVATION_PER_MINUTE', 5),
  ttl: 60_000,
};

/** Duraciones y umbrales de identidad (especificacion §12, §14). */
export const identityConfig = {
  accessTokenTtlMinutes: (c: ConfigService) => num(c, 'ACCESS_TOKEN_TTL_MINUTES', 15),
  refreshTokenTtlDays: (c: ConfigService) => num(c, 'REFRESH_TOKEN_TTL_DAYS', 7),
  activationTtlHours: (c: ConfigService) => num(c, 'ACTIVATION_TOKEN_TTL_HOURS', 48),
  passwordResetTtlMinutes: (c: ConfigService) => num(c, 'PASSWORD_RESET_TOKEN_TTL_MINUTES', 30),
  resendCooldownSeconds: (c: ConfigService) => num(c, 'ACTIVATION_RESEND_COOLDOWN_SECONDS', 120),
};

/**
 * Dominios de correo institucional autorizados (§11).
 *
 * No se codifica ninguno: la especificacion prohibe inventar el dominio real.
 * Sin configuracion, no se restringe por dominio y se avisa, porque una lista
 * vacia interpretada como "ninguno permitido" dejaria el sistema inservible.
 */
export function institutionalEmailDomains(config: ConfigService): string[] {
  const raw = config.get<string>('INSTITUTIONAL_EMAIL_DOMAINS')?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

/** ¿El correo pertenece a un dominio institucional autorizado? */
export function isInstitutionalEmail(email: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/**
 * Secreto de firma del refresh token.
 *
 * Debe ser distinto del de acceso: si coincidieran, un access token robado
 * podria presentarse como refresh y anular la ventaja de que el primero sea
 * corto. En produccion es obligatorio.
 */
export function resolveRefreshSecret(config: ConfigService, accessSecret: string): string {
  const secret = config.get<string>('JWT_REFRESH_SECRET')?.trim();
  const isProduction = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
  const isPlaceholder = !secret || secret.length < 16 || secret === accessSecret;

  if (isPlaceholder) {
    if (isProduction) {
      throw new Error(
        'JWT_REFRESH_SECRET no está configurado, es demasiado corto o coincide con '
          + 'JWT_ACCESS_SECRET. Defina un secreto propio antes de iniciar en producción.',
      );
    }
    logger.warn(
      'JWT_REFRESH_SECRET sin configurar: se usa un valor derivado solo válido en desarrollo.',
    );
    return `${accessSecret}__refresh_dev_only`;
  }
  return secret;
}
