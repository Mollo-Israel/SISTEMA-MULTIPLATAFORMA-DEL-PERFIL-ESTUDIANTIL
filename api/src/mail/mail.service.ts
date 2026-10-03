import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { appTimezone, isInstitutionalEmail } from '../config/identity.config';
import { MailCapture } from './mail-capture';
import { MailDelivery, MailMessage, MailPort, RecipientRejectedError } from './mail.port';
import { isLocalCatcher, MailSettings, readMailSettings } from './mail.settings';
import { testMail } from './templates';

/** Estado del correo, tal como lo ve el administrador. Sin secretos. */
export interface MailStatus {
  transport: 'smtp' | 'console';
  /** ¿Los correos llegan a buzones reales? */
  realDelivery: boolean;
  /** ¿Se pueden correr las pruebas automáticas sin mandar correo a direcciones inventadas? */
  safeForAutomatedTests: boolean;
  host: string | null;
  port: number | null;
  secure: boolean | null;
  authType: 'none' | 'login' | 'oauth2' | null;
  user: string | null;
  from: string;
  replyTo: string | null;
  allowedDomains: string[];
  captureEnabled: boolean;
  connection: 'ok' | 'error' | 'checking' | 'not_applicable';
  lastError: string | null;
  problems: string[];
  warnings: string[];
}

const ASCII_ADDRESS = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

/** u•••@dominio: lo justo para reconocer la cuenta sin publicarla. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  const visibles = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, visibles)}••••${email.slice(at)}`;
}

/**
 * Traduce un error de SMTP a algo que el administrador pueda corregir.
 *
 * Los proveedores responden con códigos y textos en inglés que no dicen qué
 * variable tocar. Aquí se reconocen los casos que de verdad aparecen al
 * configurar un correo por primera vez.
 */
export function explainSmtpError(error: unknown, settings?: MailSettings): string {
  const e = error as { code?: string; responseCode?: number; response?: string; message?: string };
  const texto = `${e?.response ?? ''} ${e?.message ?? ''}`;
  const destino = settings?.smtp ? `${settings.smtp.host}:${settings.smtp.port}` : 'el servidor';

  if (/5\.7\.139|SmtpClientAuthentication is disabled|basic authentication is disabled/i.test(texto)) {
    return 'Microsoft tiene desactivado el envío con usuario y contraseña (SMTP AUTH) para esa '
      + 'cuenta u organización. Use SMTP_AUTH=oauth2 o un proveedor como Gmail o Brevo '
      + '(ver docs/CORREO_REAL.md).';
  }
  if (/5\.7\.9|Application-specific password required/i.test(texto)) {
    return 'Gmail exige una contraseña de aplicación: actívela en la cuenta de Google '
      + '(Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones) y póngala en SMTP_PASSWORD.';
  }
  if (e?.code === 'EAUTH' || e?.responseCode === 535 || e?.responseCode === 534) {
    return 'El servidor rechazó el usuario o la contraseña (SMTP_USER / SMTP_PASSWORD). Con Gmail '
      + 'hace falta una contraseña de aplicación, no la contraseña normal de la cuenta.';
  }
  if (e?.code === 'EOAUTH2' || /invalid_grant|OAuth2/i.test(texto)) {
    return 'No se pudo obtener el acceso OAuth2: revise SMTP_OAUTH_CLIENT_ID, '
      + 'SMTP_OAUTH_CLIENT_SECRET y que SMTP_OAUTH_REFRESH_TOKEN no haya caducado.';
  }
  if (/CERT|certificate|self[- ]signed/i.test(texto)) {
    return `El certificado TLS de ${destino} no es válido. Si es un servidor de pruebas local, `
      + 'puede usar SMTP_TLS_REJECT_UNAUTHORIZED=false; nunca contra un proveedor real.';
  }
  if (/wrong version number|SSL routines|EPROTO/i.test(texto)) {
    return `El modo de cifrado no coincide con el puerto de ${destino}: el 465 usa SMTP_SECURE=true `
      + 'y el 587 usa SMTP_SECURE=false.';
  }
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS'].includes(e?.code ?? '')) {
    return `No se pudo conectar a ${destino}. Revise SMTP_HOST y SMTP_PORT, y que la red o el `
      + 'antivirus no bloqueen la salida por ese puerto.';
  }
  if (e?.responseCode && e.responseCode >= 550 && e.responseCode < 560) {
    return `El servidor rechazó el mensaje (${e.responseCode}): ${(e.response ?? '').slice(0, 160)}`;
  }
  if (e?.responseCode === 421 || e?.responseCode === 451 || e?.responseCode === 452) {
    return 'El proveedor está limitando los envíos por ahora; se reintentará más tarde. Si se repite, '
      + 'baje SMTP_MAX_PER_MINUTE.';
  }
  return (e?.message ?? String(error)).slice(0, 200);
}

/**
 * Salida de correo de Afinia.
 *
 * Decide el transporte, impone la regla de que solo se escribe a direcciones
 * institucionales, guarda una copia local fuera de producción y traduce los
 * errores del proveedor. Quien llama solo dice qué enviar.
 */
@Injectable()
export class MailService implements MailPort, OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Correo');
  readonly settings: MailSettings;
  private transporter: Transporter | null = null;
  private readonly capture: MailCapture | null;
  private connection: MailStatus['connection'] = 'not_applicable';
  private lastError: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.settings = readMailSettings(config);
    this.capture = this.settings.captureDir ? new MailCapture(this.settings.captureDir) : null;
  }

  onModuleInit(): void {
    const s = this.settings;
    s.warnings.forEach((w) => this.logger.warn(w));

    if (s.transport === 'console') {
      this.logger.log(
        'Correo SIMULADO: los mensajes se escriben en este registro'
          + (this.capture ? ` y en ${this.capture.dir}` : '')
          + '. Para enviarlos de verdad, configure SMTP_* en .env (docs/CORREO_REAL.md).',
      );
      return;
    }

    if (!this.prepare()) {
      s.problems.forEach((p) => this.logger.error(p));
      return;
    }
    // La comprobación no bloquea el arranque: un proveedor lento no debe
    // impedir que la API levante. Se informa en cuanto se sepa.
    void this.verify();
  }

  /**
   * Prepara el transporte SMTP sin conectar todavía.
   *
   * Devuelve false si la configuración tiene errores. Separado de
   * `onModuleInit` para que la prueba desde la terminal pueda preparar y
   * comprobar en ese orden, sin una comprobación doble.
   */
  prepare(): boolean {
    if (this.settings.transport === 'console') return true;
    if (this.settings.problems.length > 0) {
      this.connection = 'error';
      this.lastError = this.settings.problems.join(' ');
      return false;
    }
    this.transporter ??= this.buildTransport();
    this.connection = 'checking';
    return true;
  }

  onApplicationShutdown(): void {
    this.transporter?.close();
  }

  private buildTransport(): Transporter {
    const smtp = this.settings.smtp!;
    const auth =
      smtp.auth.type === 'login'
        ? { user: smtp.auth.user, pass: smtp.auth.pass }
        : smtp.auth.type === 'oauth2'
          ? {
              type: 'OAuth2' as const,
              user: smtp.auth.user,
              clientId: smtp.auth.clientId,
              clientSecret: smtp.auth.clientSecret,
              refreshToken: smtp.auth.refreshToken,
            }
          : undefined;

    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      // Con 587 se exige STARTTLS: un servidor que no lo ofrezca no recibe la
      // contraseña en claro.
      requireTLS: !smtp.secure && smtp.auth.type !== 'none',
      auth,
      tls: { rejectUnauthorized: smtp.rejectUnauthorized, minVersion: 'TLSv1.2' },
      // Una conexión reutilizada y un ritmo moderado: los proveedores
      // desconfían de quien abre veinte conexiones y dispara cien correos.
      pool: true,
      maxConnections: 2,
      rateDelta: 60_000,
      rateLimit: smtp.maxPerMinute,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    } as nodemailer.TransportOptions);
  }

  /** Comprueba conexión y credenciales contra el servidor. */
  async verify(): Promise<boolean> {
    if (this.settings.transport === 'console') return true;
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      this.connection = 'ok';
      this.lastError = null;
      const smtp = this.settings.smtp!;
      this.logger.log(
        `Correo REAL: conectado a ${smtp.host}:${smtp.port} · remitente ${this.fromHeader()}`
          + (isLocalCatcher(this.settings) ? ' (servidor local de pruebas)' : ''),
      );
      return true;
    } catch (error) {
      this.connection = 'error';
      this.lastError = explainSmtpError(error, this.settings);
      this.logger.error(`No se pudo conectar al servidor de correo: ${this.lastError}`);
      return false;
    }
  }

  private fromHeader(): string {
    const { name, address } = this.settings.from;
    return `"${name.replace(/"/g, '')}" <${address}>`;
  }

  /** ¿Puede este destinatario recibir correo de Afinia? */
  isAllowedRecipient(to: string): boolean {
    if (!ASCII_ADDRESS.test(to)) return false;
    return isInstitutionalEmail(to, this.settings.allowedDomains);
  }

  async send(message: MailMessage): Promise<MailDelivery> {
    // La prueba de configuración puede ir a cualquier buzón: quien configura
    // el correo no siempre tiene a mano una cuenta institucional. Todo lo
    // demás —activaciones, recuperaciones— solo a direcciones institucionales.
    if (message.kind !== 'test' && !this.isAllowedRecipient(message.to)) {
      this.logger.warn(`Destinatario fuera de los dominios institucionales: ${maskEmail(message.to)}`);
      throw new RecipientRejectedError(message.to);
    }

    if (this.settings.transport === 'console') {
      this.logger.log(
        `\n──────── correo simulado (no se envió) ────────\n`
          + `Para:    ${message.to}\n`
          + `Asunto:  ${message.subject}\n\n`
          + `${message.text}\n`
          + `────────────────────────────────────────────────`,
      );
      await this.capture?.write({
        ...message,
        capturedAt: new Date().toISOString(),
        transport: 'console',
        delivered: false,
      });
      return { transport: 'console' };
    }

    if (!this.transporter) {
      const motivo = this.settings.problems.join(' ') || 'El correo no está configurado.';
      await this.capture?.write({
        ...message,
        capturedAt: new Date().toISOString(),
        transport: 'smtp',
        delivered: false,
        error: motivo,
      });
      throw new Error(motivo);
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromHeader(),
        to: message.to,
        replyTo: this.settings.replyTo ?? undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: {
          // Marca el correo como automático: los clientes no responden con
          // avisos de vacaciones y algunos filtros lo agradecen.
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
        },
      });
      this.connection = 'ok';
      this.lastError = null;
      await this.capture?.write({
        ...message,
        capturedAt: new Date().toISOString(),
        transport: 'smtp',
        delivered: true,
      });
      return { transport: 'smtp', messageId: info.messageId };
    } catch (error) {
      const motivo = explainSmtpError(error, this.settings);
      this.lastError = motivo;
      this.logger.error(`No se pudo enviar a ${maskEmail(message.to)}: ${motivo}`);
      await this.capture?.write({
        ...message,
        capturedAt: new Date().toISOString(),
        transport: 'smtp',
        delivered: false,
        error: motivo,
      });
      throw new Error(motivo);
    }
  }

  /** Envía el correo de prueba de configuración. */
  async sendTest(to: string): Promise<MailDelivery> {
    const smtp = this.settings.smtp;
    const mail = testMail({
      host: smtp?.host ?? 'consola (simulado)',
      port: smtp?.port ?? 0,
      from: this.fromHeader(),
      sentAt: new Date(),
      timezone: appTimezone(this.config),
    });
    return this.send({ to, ...mail, kind: 'test' });
  }

  status(): MailStatus {
    const s = this.settings;
    const smtp = s.smtp;
    const user =
      smtp?.auth.type === 'login' || smtp?.auth.type === 'oauth2' ? smtp.auth.user : null;
    return {
      transport: s.transport,
      realDelivery: s.transport === 'smtp' && !isLocalCatcher(s),
      safeForAutomatedTests: isLocalCatcher(s),
      host: smtp?.host ?? null,
      port: smtp?.port ?? null,
      secure: smtp?.secure ?? null,
      authType: smtp?.auth.type ?? null,
      user: user ? maskEmail(user) : null,
      from: this.fromHeader(),
      replyTo: s.replyTo,
      allowedDomains: s.allowedDomains,
      captureEnabled: !!this.capture,
      connection: this.connection,
      lastError: this.lastError,
      problems: s.problems,
      warnings: s.warnings,
    };
  }
}
