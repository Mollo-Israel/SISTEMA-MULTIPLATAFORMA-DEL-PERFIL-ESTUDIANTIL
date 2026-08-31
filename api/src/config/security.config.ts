import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const DEV_FALLBACK_SECRET = 'dev_only_insecure_secret';
const logger = new Logger('SecurityConfig');

function isProduction(config: ConfigService): boolean {
  return (config.get<string>('NODE_ENV') ?? 'development') === 'production';
}

/**
 * Secreto de firma del JWT.
 *
 * En produccion es obligatorio: si falta o conserva un valor de ejemplo, la
 * aplicacion no arranca. En desarrollo se permite un valor de respaldo, pero se
 * avisa por consola para que nadie lo confunda con una configuracion completa.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_ACCESS_SECRET')?.trim();
  const isPlaceholder =
    !secret ||
    secret.length < 16 ||
    secret === 'cambiar_este_secreto_de_acceso' ||
    secret === 'dev_access_secret_cambiar';

  if (isPlaceholder) {
    if (isProduction(config)) {
      throw new Error(
        'JWT_ACCESS_SECRET no está configurado (o conserva el valor de ejemplo). ' +
          'Defina un secreto propio de al menos 16 caracteres antes de iniciar en producción.',
      );
    }
    logger.warn(
      'JWT_ACCESS_SECRET sin configurar: se usa un secreto de desarrollo. No usar así en producción.',
    );
    return DEV_FALLBACK_SECRET;
  }
  return secret;
}

/**
 * Origenes permitidos por CORS. En desarrollo, sin configuracion, se aceptan
 * los puertos habituales de Vite y Expo mas cualquier origen de red local
 * (la app movil llega por IP LAN). En produccion solo se aceptan los origenes
 * declarados en CORS_ORIGINS.
 */
export function resolveCorsOptions(config: ConfigService) {
  const raw = config.get<string>('CORS_ORIGINS')?.trim();
  const configured = raw
    ? raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  if (configured.length > 0) {
    if (configured.includes('*')) {
      return { origin: true, credentials: false };
    }
    return { origin: configured, credentials: true };
  }

  if (isProduction(config)) {
    throw new Error(
      'CORS_ORIGINS no está configurado. Declare los dominios permitidos antes de iniciar en producción.',
    );
  }

  logger.warn('CORS_ORIGINS sin configurar: se permite cualquier origen (solo desarrollo).');
  return { origin: true, credentials: false };
}
