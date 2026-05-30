import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'estudiante@univalle.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Clave123*' })
  @IsString()
  @MinLength(6)
  password: string;
}
