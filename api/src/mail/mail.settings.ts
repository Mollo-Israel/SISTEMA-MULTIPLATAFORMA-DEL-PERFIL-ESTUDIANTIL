import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { institutionalEmailDomains } from '../config/identity.config';

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
  transport: 'smtp' | 'console';
  production: boolean;
  smtp: SmtpSettings | null;
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

/**
 * Lee la configuración de correo del entorno y la valida.
 *
 * Todo lo que se pueda deducir se deduce —el modo seguro por el puerto, el
 * remitente por el usuario— y lo que esté mal se explica con la variable que
 * hay que tocar. El objetivo es que poner cuatro variables baste para que el
 * correo sea real, y que si falla diga exactamente por qué.
 */
export function readMailSettings(config: ConfigService): MailSettings {
  const get = (k: string) => config.get<string>(k)?.trim() ?? '';
  const production = (get('NODE_ENV') || 'development') === 'production';
  const problems: string[] = [];
  const warnings: string[] = [];

  const host = get('SMTP_HOST');
  const elegido = (get('MAIL_TRANSPORT') || 'auto').toLowerCase();
  let transport: 'smtp' | 'console';
  if (elegido === 'console') {
    transport = 'console';
  } else if (elegido === 'smtp') {
    transport = 'smtp';
    if (!host) problems.push('MAIL_TRANSPORT=smtp pero SMTP_HOST está vacío.');
  } else {
    if (elegido !== 'auto') {
      warnings.push(`MAIL_TRANSPORT="${elegido}" no se reconoce; se usa "auto".`);
    }
    transport = host ? 'smtp' : 'console';
  }

  // ------------------------------------------------------------ remitente
  const user = get('SMTP_USER');
  let fromName = get('SMTP_FROM_NAME') || 'Afinia';
  let fromAddress = get('SMTP_FROM');
  const conNombre = /^(.*)<([^>]+)>\s*$/.exec(fromAddress);
  if (conNombre) {
    fromName = conNombre[1].trim().replace(/^"|"$/g, '') || fromName;
    fromAddress = conNombre[2].trim();
  }
  if (!fromAddress && ADDRESS_RE.test(user)) fromAddress = user;
  if (!fromAddress) fromAddress = 'no-reply@afinia.local';

  if (transport === 'smtp') {
    if (!ADDRESS_RE.test(fromAddress) || fromAddress.endsWith('.local')) {
      problems.push(
        'SMTP_FROM debe ser una dirección real desde la que el proveedor permita enviar '
          + '(normalmente la misma cuenta de SMTP_USER).',
      );
    } else if (
      user
      && ADDRESS_RE.test(user)
      && fromAddress.toLowerCase() !== user.toLowerCase()
      && /gmail\.com|googlemail\.com|outlook\.com|office365\.com|hotmail\.com/i.test(host)
    ) {
      warnings.push(
        `SMTP_FROM (${fromAddress}) no coincide con SMTP_USER (${user}). Gmail y Outlook `
          + 'reescriben o rechazan un remitente distinto de la cuenta, salvo que sea un alias '
          + 'verificado en esa cuenta.',
      );
    }
  }

  // ------------------------------------------------------------ SMTP
  let smtp: SmtpSettings | null = null;
  if (transport === 'smtp' && host) {
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

    const authType = (get('SMTP_AUTH') || (user ? 'login' : 'none')).toLowerCase();
    let auth: SmtpAuth = { type: 'none' };
    if (authType === 'login') {
      // Google muestra las contraseñas de aplicación en cuatro grupos separados
      // por espacios; se aceptan pegadas tal cual.
      const pass = config.get<string>('SMTP_PASSWORD') ?? '';
      const passLimpia = /gmail|google/i.test(host) ? pass.replace(/\s+/g, '') : pass;
      if (!user || !passLimpia) {
        problems.push('SMTP_AUTH=login necesita SMTP_USER y SMTP_PASSWORD.');
      }
      auth = { type: 'login', user, pass: passLimpia };
    } else if (authType === 'oauth2') {
      const clientId = get('SMTP_OAUTH_CLIENT_ID');
      const clientSecret = get('SMTP_OAUTH_CLIENT_SECRET');
      const refreshToken = get('SMTP_OAUTH_REFRESH_TOKEN');
      if (!user || !clientId || !clientSecret || !refreshToken) {
        problems.push(
          'SMTP_AUTH=oauth2 necesita SMTP_USER, SMTP_OAUTH_CLIENT_ID, '
            + 'SMTP_OAUTH_CLIENT_SECRET y SMTP_OAUTH_REFRESH_TOKEN.',
        );
      }
      auth = { type: 'oauth2', user, clientId, clientSecret, refreshToken };
    } else if (authType !== 'none') {
      problems.push(`SMTP_AUTH="${authType}" no se reconoce: use login, oauth2 o none.`);
    }

    const maxPerMinute = Number(get('SMTP_MAX_PER_MINUTE') || 20);
    smtp = {
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
  }

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

  return {
    transport,
    production,
    smtp,
    from: { name: fromName, address: fromAddress },
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
