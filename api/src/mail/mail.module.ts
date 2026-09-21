import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_PORT, MailMessage, MailPort } from './mail.port';

/**
 * Adaptador de desarrollo: escribe el correo en el log en lugar de enviarlo.
 *
 * Permite probar activacion y recuperacion sin montar un SMTP. El enlace
 * aparece en la consola de la API, que en desarrollo es donde el desarrollador
 * ya esta mirando.
 */
class ConsoleMailAdapter implements MailPort {
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `\n──────── correo simulado ────────\n`
        + `Para:    ${message.to}\n`
        + `Asunto:  ${message.subject}\n\n`
        + `${message.text}\n`
        + `─────────────────────────────────`,
    );
  }
}

/**
 * Adaptador SMTP real. Carga `nodemailer` de forma perezosa para que el
 * paquete sea opcional: quien solo trabaja en desarrollo no necesita tenerlo.
 */
class SmtpMailAdapter implements MailPort {
  private readonly logger = new Logger('Mail');
  private transport: { sendMail: (o: unknown) => Promise<unknown> } | null = null;

  constructor(private readonly config: ConfigService) {}

  private async getTransport() {
    if (this.transport) return this.transport;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer');
    this.transport = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: Number(this.config.get<string>('SMTP_PORT') ?? 587) === 465,
      auth: this.config.get<string>('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });
    return this.transport!;
  }

  async send(message: MailMessage): Promise<void> {
    // RNF09: que el correo falle no puede tumbar la operacion. El token ya
    // quedo emitido y el usuario puede pedir un reenvio.
    try {
      const transport = await this.getTransport();
      await transport.sendMail({
        from: this.config.get<string>('SMTP_FROM', 'no-reply@afinia.local'),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el correo a ${message.to}: ${(error as Error).message}`);
      throw error;
    }
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailPort => {
        const host = config.get<string>('SMTP_HOST')?.trim();
        return host ? new SmtpMailAdapter(config) : new ConsoleMailAdapter();
      },
    },
  ],
  exports: [MAIL_PORT],
})
export class MailModule {}
