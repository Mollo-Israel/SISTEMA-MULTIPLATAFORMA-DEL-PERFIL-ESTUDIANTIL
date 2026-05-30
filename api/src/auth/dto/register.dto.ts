import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Estudiante' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Univalle' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'estudiante@univalle.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Clave123*', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
