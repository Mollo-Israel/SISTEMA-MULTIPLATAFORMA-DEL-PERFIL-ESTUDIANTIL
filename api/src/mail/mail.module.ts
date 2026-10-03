import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MAIL_PORT } from './mail.port';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';

/**
 * Correo saliente (§101).
 *
 * Un único servicio decide el transporte —SMTP real o consola de desarrollo—
 * a partir de `.env`. El resto del sistema depende del puerto `MAIL_PORT`, no
 * del servicio: cambiar de proveedor no toca activación ni recuperación.
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MailController],
  providers: [MailService, { provide: MAIL_PORT, useExisting: MailService }],
  exports: [MAIL_PORT, MailService],
})
export class MailModule {}
