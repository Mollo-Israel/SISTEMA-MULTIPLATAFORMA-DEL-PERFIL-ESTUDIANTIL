import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { VerifiedEmailsService } from './verified-emails.service';

export class AddVerifiedEmailDto {
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(254)
  email: string;
}

export class ConfirmVerifiedEmailDto {
  @IsString()
  @Length(6, 9)
  @Matches(/^[\d\s-]+$/, { message: 'El código son seis dígitos.' })
  code: string;
}

/** Límite propio: cada pedido manda un correo a una dirección externa. */
const LIMITE_CORREOS = { limit: 5, ttl: 60_000 };

/**
 * V9 · Correos personales comprobados del estudiante (para reconocer al
 * destinatario de sus insignias de Credly, Coursera, Accredible…).
 */
@ApiTags('validación de credenciales')
@ApiBearerAuth()
@Controller('verified-emails')
export class VerifiedEmailsController {
  constructor(private readonly emails: VerifiedEmailsService) {}

  @Get()
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Mis correos personales (comprobados y pendientes)' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.emails.list(user.userId);
  }

  @Post()
  @Roles(RolNombre.STUDENT)
  @Throttle({ default: LIMITE_CORREOS })
  @ApiOperation({ summary: 'Agregar un correo personal: envía un código de seis dígitos a ese buzón' })
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddVerifiedEmailDto) {
    return this.emails.request(user.userId, dto.email);
  }

  @Post(':id/resend')
  @Roles(RolNombre.STUDENT)
  @Throttle({ default: LIMITE_CORREOS })
  @ApiOperation({ summary: 'Reenviar el código' })
  async resend(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    const actual = (await this.emails.list(user.userId)).find((e) => e.id === id);
    return this.emails.request(user.userId, actual?.email ?? '');
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @Roles(RolNombre.STUDENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirmar con el código recibido' })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmVerifiedEmailDto,
  ) {
    return this.emails.confirm(user.userId, id, dto.code);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Quitar un correo personal' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.emails.remove(user.userId, id);
  }
}
