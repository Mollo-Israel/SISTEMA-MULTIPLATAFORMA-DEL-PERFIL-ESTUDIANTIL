import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { RolNombre, UserStatus } from '@perfil/shared';
import { EMAIL_MSG, NAME_MSG, NAME_RE, PASSWORD_MSG, PASSWORD_RE, trim, trimLower, UNIVALLE_RE } from '../../common/validation';

export class CreateUserDto {
  @ApiProperty({ example: 'Carlos' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El nombre no puede superar 50 caracteres.' })
  @Matches(NAME_RE, { message: `El nombre. ${NAME_MSG}` })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @Transform(trim)
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

  @ApiProperty({ enum: RolNombre, example: RolNombre.TEACHER })
  @IsEnum(RolNombre)
  role: RolNombre;

  @ApiProperty({ enum: UserStatus, required: false, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
