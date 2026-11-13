import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { institutionalEmailDomains } from '../config/identity.config';
import { separarNombreYDireccion } from '../common/texto';

export type SmtpAuth =
  | { type: 'none' }
  | { type: 'login'; user: string; pass: string }
  | {
      type: 'oauth2';
      user: string;
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    };

export interface SmtpSettings {
  host: string;
  port: number;
  /** TLS desde el primer byte (465). Con `false` se negocia STARTTLS (587). */
  secure: boolean;
  auth: SmtpAuth;
  rejectUnauthorized: boolean;
  /** Tope de envíos por minuto, para no disparar los filtros del proveedor. */
  maxPerMinute: number;
}

export interface MailSettings {
  transport: 'smtp' | 'brevo' | 'console';
  production: boolean;
  smtp: SmtpSettings | null;
  /** API HTTPS de Brevo: sirve donde el hosting bloquea la salida SMTP. */
  brevo: { apiKey: string; apiUrl: string } | null;
  from: { name: string; address: string };
  replyTo: string | null;
  /** Copia local de cada correo, solo fuera de producción. */
  captureDir: string | null;
  allowedDomains: string[];
  /** Errores de configuración: con SMTP elegido, impiden enviar. */
  problems: string[];
  /** Cosas que funcionan pero conviene corregir. */
  warnings: string[];
}

const ADDRESS_RE = /^[^\s@<>"(),;:]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type Leer = (k: string) => string;

/** El transporte elegido (o deducido en modo «auto»). */
function elegirTransporte(get: Leer, problems: string[], warnings: string[]): MailSettings['transport'] {
  const host = get('SMTP_HOST');
  const brevoKey = get('BREVO_API_KEY');
  const elegido = (get('MAIL_TRANSPORT') || 'auto').toLowerCase();
  if (elegido === 'console') return 'console';
  if (elegido === 'brevo') {
    if (!brevoKey) problems.push('MAIL_TRANSPORT=brevo pero BREVO_API_KEY está vacío.');
    return 'brevo';
  }
  if (elegido === 'smtp') {
    if (!host) problems.push('MAIL_TRANSPORT=smtp pero SMTP_HOST está vacío.');
    return 'smtp';
  }
  if (elegido !== 'auto') {
    warnings.push(`MAIL_TRANSPORT="${elegido}" no se reconoce; se usa "auto".`);
  }
  if (host) return 'smtp';
  if (brevoKey) return 'brevo';
  return 'console';
}

/** El remitente: nombre y dirección, aceptando «Nombre <dir>» y, si falta, la cuenta SMTP. */
function leerRemitente(get: Leer): { name: string; address: string } {
  const user = get('SMTP_USER');
  let fromName = get('MAIL_FROM_NAME') || get('SMTP_FROM_NAME') || 'Afinia';
  let fromAddress = get('MAIL_FROM') || get('SMTP_FROM');
  const conNombre = separarNombreYDireccion(fromAddress);
  if (conNombre) {
    fromName = conNombre[0].trim().replace(/^"|"$/g, '') || fromName;
    fromAddress = conNombre[1].trim();
  }
  if (!fromAddress && ADDRESS_RE.test(user)) fromAddress = user;
  if (!fromAddress) fromAddress = 'no-reply@afinia.local';
  return { name: fromName, address: fromAddress };
}

/** Un remitente que el proveedor acepte, y el aviso de Gmail/Outlook si no coincide con la cuenta. */
function revisarRemitente(transport: MailSettings['transport'], fromAddress: string, get: Leer, problems: string[], warnings: string[]): void {
  if (transport !== 'smtp' && transport !== 'brevo') return;
  const user = get('SMTP_USER');
  if (!ADDRESS_RE.test(fromAddress) || fromAddress.endsWith('.local')) {
    problems.push(
      (transport === 'brevo' ? 'MAIL_FROM debe ser un remitente verificado en Brevo.'
        : 'SMTP_FROM debe ser una dirección real desde la que el proveedor permita enviar '
          + '(normalmente la misma cuenta de SMTP_USER).'),
    );
    return;
  }
  const proveedorEstricto = /gmail\.com|googlemail\.com|outlook\.com|office365\.com|hotmail\.com/i.test(get('SMTP_HOST'));
  if (transport === 'smtp' && user && ADDRESS_RE.test(user) && fromAddress.toLowerCase() !== user.toLowerCase() && proveedorEstricto) {
    warnings.push(
      `SMTP_FROM (${fromAddress}) no coincide con SMTP_USER (${user}). Gmail y Outlook `
        + 'reescriben o rechazan un remitente distinto de la cuenta, salvo que sea un alias '
        + 'verificado en esa cuenta.',
    );
  }
}

/** Puerto y modo seguro, con los avisos de las combinaciones que suelen colgarse. */
function leerPuerto(get: Leer, problems: string[], warnings: string[]): { port: number; secure: boolean } {
  const port = Number(get('SMTP_PORT') || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push('SMTP_PORT debe ser un número de puerto (normalmente 587 o 465).');
  }
  const secureRaw = get('SMTP_SECURE').toLowerCase();
  const secure = secureRaw === '' ? port === 465 : secureRaw === 'true';
  if (port === 465 && !secure) {
    warnings.push('El puerto 465 espera SMTP_SECURE=true; con false la conexión suele colgarse.');
  }
  if (port === 587 && secure) {
    warnings.push('El puerto 587 usa STARTTLS: deje SMTP_SECURE vacío o en false.');
  }
  return { port, secure };
}

/** La autenticación SMTP: login (con contraseña de aplicación), oauth2 o ninguna. */
function leerAutenticacion(config: ConfigService, get: Leer, host: string, problems: string[]): SmtpAuth {
  const user = get('SMTP_USER');
  const authType = (get('SMTP_AUTH') || (user ? 'login' : 'none')).toLowerCase();
  if (authType === 'login') {
    // Google muestra las contraseñas de aplicación en cuatro grupos separados
    // por espacios; se aceptan pegadas tal cual.
    const pass = config.get<string>('SMTP_PASSWORD') ?? '';
    const passLimpia = /gmail|google/i.test(host) ? pass.replace(/\s+/g, '') : pass;
    if (!user || !passLimpia) {
      problems.push('SMTP_AUTH=login necesita SMTP_USER y SMTP_PASSWORD.');
    }
    return { type: 'login', user, pass: passLimpia };
  }
  if (authType === 'oauth2') {
    const clientId = get('SMTP_OAUTH_CLIENT_ID');
    const clientSecret = get('SMTP_OAUTH_CLIENT_SECRET');
    const refreshToken = get('SMTP_OAUTH_REFRESH_TOKEN');
    if (!user || !clientId || !clientSecret || !refreshToken) {
      problems.push(
        'SMTP_AUTH=oauth2 necesita SMTP_USER, SMTP_OAUTH_CLIENT_ID, '
          + 'SMTP_OAUTH_CLIENT_SECRET y SMTP_OAUTH_REFRESH_TOKEN.',
      );
    }
    return { type: 'oauth2', user, clientId, clientSecret, refreshToken };
  }
  if (authType !== 'none') {
    problems.push(`SMTP_AUTH="${authType}" no se reconoce: use login, oauth2 o none.`);
  }
  return { type: 'none' };
}

/** La configuración SMTP completa (solo si el transporte es SMTP y hay servidor). */
function leerSmtp(config: ConfigService, get: Leer, problems: string[], warnings: string[]): SmtpSettings {
  const host = get('SMTP_HOST');
  const { port, secure } = leerPuerto(get, problems, warnings);
  const auth = leerAutenticacion(config, get, host, problems);
  const maxPerMinute = Number(get('SMTP_MAX_PER_MINUTE') || 20);
  const smtp: SmtpSettings = {
    host,
    port,
    secure,
    auth,
    rejectUnauthorized: get('SMTP_TLS_REJECT_UNAUTHORIZED').toLowerCase() !== 'false',
    maxPerMinute: Number.isFinite(maxPerMinute) && maxPerMinute > 0 ? maxPerMinute : 20,
  };
  if (!smtp.rejectUnauthorized) {
    warnings.push(
      'SMTP_TLS_REJECT_UNAUTHORIZED=false acepta certificados no válidos. '
        + 'Úselo solo contra un servidor de pruebas local.',
    );
  }
  return smtp;
}

/**
 * Lee la configuración de correo del entorno y la valida.
 *
 * Todo lo que se pueda deducir se deduce —el modo seguro por el puerto, el
 * remitente por el usuario— y lo que esté mal se explica con la variable que
 * hay que tocar. El objetivo es que poner cuatro variables baste para que el
 * correo sea real, y que si falla diga exactamente por qué.
 */
export function readMailSettings(config: ConfigService): MailSettings {
  const get: Leer = (k) => config.get<string>(k)?.trim() ?? '';
  const production = (get('NODE_ENV') || 'development') === 'production';
  const problems: string[] = [];
  const warnings: string[] = [];

  const transport = elegirTransporte(get, problems, warnings);
  const from = leerRemitente(get);
  revisarRemitente(transport, from.address, get, problems, warnings);
  const smtp = transport === 'smtp' && get('SMTP_HOST') ? leerSmtp(config, get, problems, warnings) : null;

  const replyTo = get('SMTP_REPLY_TO');
  if (replyTo && !ADDRESS_RE.test(replyTo)) {
    warnings.push('SMTP_REPLY_TO no es una dirección válida; se ignora.');
  }

  // La copia local existe para desarrollar y para que las pruebas lean el
  // código sin que el administrador lo vea nunca. En producción no hay copia:
  // ahí el correo solo debe existir en el buzón de su destinatario.
  const captureDir = production
    ? null
    : resolve(get('MAIL_CAPTURE_DIR') || resolve(process.cwd(), '.mail-outbox'));

  const brevoKey = get('BREVO_API_KEY');
  return {
    transport,
    production,
    smtp,
    brevo: transport === 'brevo' && brevoKey
      ? { apiKey: brevoKey, apiUrl: get('BREVO_API_URL') || 'https://api.brevo.com/v3/smtp/email' }
      : null,
    from,
    replyTo: replyTo && ADDRESS_RE.test(replyTo) ? replyTo : null,
    captureDir,
    allowedDomains: institutionalEmailDomains(config),
    problems,
    warnings,
  };
}

/** ¿Es un servidor local de pruebas, que no entrega a buzones reales? */
export function isLocalCatcher(settings: MailSettings): boolean {
  if (settings.transport === 'console') return true;
  const host = settings.smtp?.host.toLowerCase() ?? '';
  return ['localhost', '127.0.0.1', '::1', 'mailpit', 'mailhog'].includes(host);
}
