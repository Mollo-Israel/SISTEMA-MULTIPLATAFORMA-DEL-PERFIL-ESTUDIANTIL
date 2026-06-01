import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { trimLower } from '../../common/validation';

export class LoginDto {
  @ApiProperty({ example: 'estudiante@univalle.edu' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  email: string;

  @ApiProperty({ example: 'Clave123*' })
  @IsString()
  @MinLength(6, { message: 'La contraseña es obligatoria.' })
  password: string;
}
