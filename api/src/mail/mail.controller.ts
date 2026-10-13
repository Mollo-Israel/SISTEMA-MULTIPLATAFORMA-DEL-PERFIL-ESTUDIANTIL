import {
  BadRequestException, Body, CanActivate, Controller, Get, HttpCode, Injectable, NotFoundException, Post, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { trimLower } from '../common/validation';
import { MailService, maskEmail } from './mail.service';

class MailTestDto {
  /** Si se omite, se envía al correo del administrador que lo pide. */
  @IsOptional()
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escriba un correo válido.' })
  @MaxLength(160)
  to?: string;
}

/**
 * V3.2 §60: el diagnóstico del correo es configuración de despliegue, no parte
 * del producto ordinario. Fuera de desarrollo solo existe con el modo técnico
 * explícito `MAIL_DIAGNOSTICS_ENABLED=true`; si no, responde 404 como cualquier
 * ruta inexistente (no se anuncia). Se suma al rol: sigue siendo solo Admin.
 */
@Injectable()
export class MailDiagnosticsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    const produccion = (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
    const habilitado = this.config.get<string>('MAIL_DIAGNOSTICS_ENABLED') === 'true';
    if (produccion && !habilitado) throw new NotFoundException();
    return true;
  }
}

/**
 * Diagnóstico del correo, solo para administración.
 *
 * Existe para cerrar el ciclo de configurarlo: se ponen las credenciales en
 * `.env`, se reinicia, y desde el panel se ve si conectó y se manda una prueba
 * sin tener que crear una cuenta de estudiante para comprobarlo.
 */
@ApiTags('mail')
@ApiBearerAuth()
@Controller('mail')
@Roles(RolNombre.ADMIN)
@UseGuards(MailDiagnosticsGuard)
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Estado del envío de correo.',
    description: 'Transporte, servidor, remitente y si la conexión funciona. Nunca devuelve contraseñas.',
  })
  status() {
    return this.mail.status();
  }

  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: 'Vuelve a comprobar la conexión con el servidor de correo.' })
  async verify() {
    await this.mail.verify();
    return this.mail.status();
  }

  @Post('test')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Envía un correo de prueba.',
    description:
      'Al correo indicado o, si se omite, al del administrador. Es el único correo que puede '
      + 'ir a una dirección no institucional: sirve para comprobar la configuración.',
  })
  async test(@CurrentUser() admin: AuthenticatedUser, @Body() dto: MailTestDto) {
    const to = dto.to ?? admin.email;
    try {
      const entrega = await this.mail.sendTest(to);
      return {
        sentTo: maskEmail(to),
        transport: entrega.transport,
        message:
          entrega.transport === 'smtp'
            ? `Correo de prueba enviado a ${to}. Revisa la bandeja de entrada y la de no deseado.`
            : 'El correo está en modo simulado: la prueba quedó escrita en el registro de la API, '
              + 'no salió a ningún buzón.',
      };
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
