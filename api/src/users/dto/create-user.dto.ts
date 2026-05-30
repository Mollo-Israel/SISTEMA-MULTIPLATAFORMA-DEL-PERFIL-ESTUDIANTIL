import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RolNombre, UserStatus } from '@perfil/shared';

export class CreateUserDto {
  @ApiProperty({ example: 'Docente' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Univalle' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'docente@univalle.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Clave123*', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @ApiProperty({ enum: RolNombre, example: RolNombre.TEACHER })
  @IsEnum(RolNombre)
  role: RolNombre;

  @ApiProperty({ enum: UserStatus, required: false, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
