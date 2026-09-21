/**
 * Puerto de salida de correo (especificacion §101).
 *
 * El dominio pide "envia esto"; no sabe si detras hay SMTP, un servicio
 * externo o la consola de desarrollo. Cambiar de proveedor no debe obligar a
 * tocar activacion, recuperacion ni importacion.
 */
export const MAIL_PORT = Symbol('MAIL_PORT');

export interface MailMessage {
  to: string;
  subject: string;
  /** Cuerpo en texto plano. Obligatorio: no todos los clientes muestran HTML. */
  text: string;
  html?: string;
}

export interface MailPort {
  send(message: MailMessage): Promise<void>;
}
