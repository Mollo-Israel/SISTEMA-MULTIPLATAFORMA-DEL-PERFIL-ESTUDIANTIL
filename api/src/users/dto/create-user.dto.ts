import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { RolNombre, UserStatus } from '@perfil/shared';
import { cleanLine, EMAIL_MSG, NAME_MSG, NAME_RE, PASSWORD_MSG, PASSWORD_RE, trimLower, UNIVALLE_RE } from '../../common/validation';

/**
 * Roles que el administrador puede dar de alta (RF3).
 * El estudiante se registra por si mismo y siempre obtiene STUDENT; la cuenta
 * de administrador es unica y se crea por seed, no por este endpoint.
 */
export const INSTITUTIONAL_ROLES = [
  RolNombre.TEACHER,
  RolNombre.CAREER_DIRECTOR,
  RolNombre.SCIENTIFIC_SOCIETY,
] as const;

export class CreateUserDto {
  @ApiProperty({ example: 'Carlos' })
  @Transform(cleanLine)
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El nombre no puede superar 50 caracteres.' })
  @Matches(NAME_RE, { message: `El nombre. ${NAME_MSG}` })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @Transform(cleanLine)
  @IsString()
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El apellido no puede superar 50 caracteres.' })
  @Matches(NAME_RE, { message: `El apellido. ${NAME_MSG}` })
  lastName: string;

  @ApiProperty({ example: 'carlos.perez@univalle.edu' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(160, { message: 'El correo es demasiado largo.' })
  @Matches(UNIVALLE_RE, { message: EMAIL_MSG })
  email: string;

  @ApiProperty({ example: 'Clave123*', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga.' })
  @Matches(PASSWORD_RE, { message: PASSWORD_MSG })
  password: string;

  @ApiProperty({
    enum: INSTITUTIONAL_ROLES,
    example: RolNombre.TEACHER,
    description: 'Solo roles institucionales: docente, director de carrera o sociedad científica.',
  })
  @IsEnum(RolNombre)
  @IsIn(INSTITUTIONAL_ROLES as unknown as RolNombre[], {
    message:
      'Solo se pueden crear usuarios institucionales (docente, director de carrera o sociedad científica). El estudiante se registra por su cuenta.',
  })
  role: RolNombre;

  @ApiProperty({ enum: UserStatus, required: false, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
