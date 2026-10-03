import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN, trimLower } from '../../common/validation';

/**
 * Pedir activación o recuperación. Solo el correo: la respuesta es genérica,
 * de modo que este endpoint no sirve para enumerar cuentas (§12).
 */
export class RequestByEmailDto {
  @ApiProperty({ example: 'ana.quispe@est.univalle.edu' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(160, { message: 'El correo es demasiado largo.' })
  email: string;
}

/**
 * Canjear un enlace o un código por una contraseña.
 *
 * Dos formas equivalentes: el `token` del enlace, o el `email` con el `code`
 * de seis dígitos que trae el mismo correo. El servicio exige una de las dos.
 * La política completa de contraseña (§13) se valida allí, donde se conocen
 * el correo y el código universitario del titular.
 */
export class ConsumeTokenDto {
  @ApiProperty({ required: false, description: 'Token del enlace del correo.' })
  @IsOptional()
  @IsString()
  @MinLength(16, { message: 'El enlace no es válido.' })
  @MaxLength(200, { message: 'El enlace no es válido.' })
  token?: string;

  @ApiProperty({ required: false, example: 'ana.quispe@est.univalle.edu' })
  @IsOptional()
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escribe tu correo institucional.' })
  @MaxLength(160, { message: 'El correo es demasiado largo.' })
  email?: string;

  @ApiProperty({ required: false, example: '482913', description: 'Código de 6 dígitos del correo.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos.' })
  code?: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString({ message: 'Escribe una contraseña.' })
  @MinLength(PASSWORD_MIN, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX, { message: 'La contraseña es demasiado larga.' })
  password: string;
}

/** Preguntar por el estado de un enlace antes de pedir la contraseña. */
export class CheckTokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  token: string;

  @ApiProperty({ enum: ['activation', 'reset'] })
  @IsIn(['activation', 'reset'], { message: 'Propósito no válido.' })
  purpose: 'activation' | 'reset';
}
