import { ConfigService } from '@nestjs/config';
import { quitarBarrasFinales } from '../common/texto';

/**
 * Configuración de los registros verificables (V8).
 *
 * - `CREDENTIALS_PUBLIC_API_URL`: dirección pública de la API con `/api`.
 *   Es parte de lo firmado (emisor, claves, listas de estado), así que debe
 *   ser estable. En desarrollo se deduce del puerto. En producción, si falta,
 *   no se emite nada nuevo, aunque se sigue verificando lo ya emitido.
 * - `CREDENTIALS_ISSUER_NAME`: nombre del emisor que ven los verificadores.
 * - `CREDENTIALS_SIGNING_KEY`: semilla Ed25519 de 32 bytes (hex o base64url).
 *   Sin ella, la clave se deriva del secreto JWT con HKDF.
 */
export interface CredentialsSettings {
  apiBase: string | null;
  webBase: string;
  issuerName: string;
  production: boolean;
}

export function readCredentialsSettings(config: ConfigService): CredentialsSettings {
  const production = (config.get<string>('NODE_ENV') ?? 'development') === 'production';
  const configurada = config.get<string>('CREDENTIALS_PUBLIC_API_URL')?.trim();
  const puerto = config.get<string>('API_PORT') ?? '3000';
  const apiBase = configurada
    ? quitarBarrasFinales(configurada)
    : production ? null : `http://localhost:${puerto}/api`;
  const webBase = quitarBarrasFinales(config.get<string>('WEB_APP_URL')?.trim() || 'http://localhost:5173');
  const issuerName = config.get<string>('CREDENTIALS_ISSUER_NAME')?.trim() || 'Afinia · Registro de trayectoria estudiantil';
  return { apiBase, webBase, issuerName, production };
}

const envNum = (key: string, fallback: number): number => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/** Verificación pública por código o credencial: 30 por minuto y por IP. */
export const CREDENTIAL_VERIFY_RATE_LIMIT = { limit: envNum('RATE_LIMIT_CREDENTIAL_VERIFY_PER_MINUTE', 30), ttl: 60_000 };

/** Verificación de archivos: más cara, 10 por minuto y por IP. */
export const CREDENTIAL_FILE_RATE_LIMIT = { limit: envNum('RATE_LIMIT_CREDENTIAL_FILE_PER_MINUTE', 10), ttl: 60_000 };

/** Documentos públicos (emisor, claves, listas, insignias): 120 por minuto. */
export const CREDENTIAL_DOCS_RATE_LIMIT = { limit: envNum('RATE_LIMIT_CREDENTIAL_DOCS_PER_MINUTE', 120), ttl: 60_000 };

/** Rutas de los documentos públicos, relativas a `apiBase`. */
export const RUTAS = {
  issuer: '/public/credentials/issuer',
  keys: '/public/credentials/keys',
  status: (proposito: 'revocation' | 'suspension') => `/public/credentials/status/${proposito}`,
  credential: (code: string) => `/public/credentials/${code}/ob3`,
  verify: (code: string) => `/public/credentials/${code}`,
  ob2Issuer: '/public/credentials/ob2/issuer',
  ob2Badge: (code: string) => `/public/credentials/ob2/badges/${code}`,
  ob2BadgeImage: (code: string) => `/public/credentials/ob2/badges/${code}/image.svg`,
  ob2Assertion: (code: string) => `/public/credentials/ob2/assertions/${code}`,
  ledgerHead: '/public/credentials/ledger/head',
};

/** La página web donde una persona verifica un código. */
export const paginaDeVerificacion = (webBase: string, code: string) => `${webBase}/verificar/${code}`;
