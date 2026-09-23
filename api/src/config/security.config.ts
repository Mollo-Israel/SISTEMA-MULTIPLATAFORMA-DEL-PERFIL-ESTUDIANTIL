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
 * Origenes permitidos por CORS (§84, §100).
 *
 * Lee `WEB_ORIGINS`, que es el nombre que fija §100 y el que valida el chequeo
 * de entorno. Antes leia `CORS_ORIGINS` y nadie los reconciliaba: quien
 * configuraba el sistema siguiendo la especificacion definia `WEB_ORIGINS`, el
 * arranque lo daba por bueno y CORS se quedaba aceptando cualquier origen sin
 * que nada lo dijera. `CORS_ORIGINS` sigue funcionando como alias historico.
 *
 * En desarrollo, sin ninguno de los dos, se acepta cualquier origen y se avisa:
 * la app movil llega por IP de red local y enumerarlas seria inutil. En
 * produccion, sin lista, no se arranca.
 */
export function resolveCorsOptions(config: ConfigService) {
  const raw = (config.get<string>('WEB_ORIGINS') ?? config.get<string>('CORS_ORIGINS'))?.trim();
  const configured = raw
    ? raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  if (configured.length > 0) {
    if (configured.includes('*')) {
      // Un comodin explicito se respeta, pero nunca con credenciales: las dos
      // cosas juntas convierten cualquier pagina en un cliente autenticado.
      logger.warn('WEB_ORIGINS incluye «*»: se acepta cualquier origen, sin credenciales.');
      return { origin: true, credentials: false };
    }
    return { origin: configured, credentials: true };
  }

  if (isProduction(config)) {
    throw new Error(
      'WEB_ORIGINS no está configurado. Declare los dominios permitidos antes de '
      + 'iniciar en producción.',
    );
  }

  logger.warn('WEB_ORIGINS sin configurar: se permite cualquier origen (solo desarrollo).');
  return { origin: true, credentials: false };
}
