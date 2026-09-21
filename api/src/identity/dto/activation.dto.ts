import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN, trimLower } from '../../common/validation';

/**
 * Pedir activación o recuperación. Solo el correo: la respuesta es genérica,
 * de modo que este endpoint no sirve para enumerar cuentas (§12).
 */
export class RequestByEmailDto {
  @ApiProperty({ example: 'ana.quispe@est.univalle.edu' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escriba un correo válido.' })
  @MaxLength(160)
  email: string;
}

/**
 * Consumir un token y fijar la contraseña.
 *
 * La política completa (§13) se valida en el servicio, donde se conocen el
 * correo y el código universitario del titular. Aquí solo el formato mínimo,
 * para no rechazar con un mensaje que no explique nada.
 */
export class ConsumeTokenDto {
  @ApiProperty({ description: 'Código recibido por correo.' })
  @IsString()
  @MinLength(16, { message: 'El código no es válido.' })
  @MaxLength(200)
  token: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  password: string;
}
