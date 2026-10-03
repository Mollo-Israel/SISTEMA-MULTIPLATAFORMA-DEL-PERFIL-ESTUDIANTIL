/**
 * Puerto de salida de correo (especificacion §101).
 *
 * El dominio pide "envia esto"; no sabe si detras hay SMTP, un servicio
 * externo o la consola de desarrollo. Cambiar de proveedor no debe obligar a
 * tocar activacion, recuperacion ni importacion.
 */
export const MAIL_PORT = Symbol('MAIL_PORT');

/** Qué tipo de correo es, para el registro y para la captura de desarrollo. */
export type MailKind = 'account_activation' | 'password_reset' | 'test';

export interface MailMessage {
  to: string;
  subject: string;
  /** Cuerpo en texto plano. Obligatorio: no todos los clientes muestran HTML. */
  text: string;
  html?: string;
  kind?: MailKind;
}

/** Cómo salió un correo. */
export interface MailDelivery {
  /** `smtp` lo entregó a un servidor de correo; `console` solo lo escribió en el registro. */
  transport: 'smtp' | 'console';
  messageId?: string;
}

export interface MailPort {
  /**
   * Envía el correo o lanza un error con un motivo legible.
   *
   * Lanza también si el destinatario no pertenece a un dominio institucional:
   * esa regla no la decide quien llama, la impone el puerto.
   */
  send(message: MailMessage): Promise<MailDelivery>;
}

/** El destinatario no está permitido por la política de dominios. */
export class RecipientRejectedError extends Error {
  constructor(public readonly recipient: string) {
    super(
      'El correo solo se envía a direcciones institucionales. '
        + 'Revise INSTITUTIONAL_EMAIL_DOMAINS.',
    );
    this.name = 'RecipientRejectedError';
  }
}
