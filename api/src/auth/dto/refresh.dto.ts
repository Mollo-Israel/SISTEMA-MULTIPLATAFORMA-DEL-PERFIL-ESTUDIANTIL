import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Canje o revocación de una sesión (especificación §14). */
export class RefreshDto {
  @ApiProperty({ description: 'Refresh token opaco entregado al iniciar sesión.' })
  @IsString()
  @MinLength(16, { message: 'El token de sesión no es válido.' })
  @MaxLength(200)
  refreshToken: string;
}
