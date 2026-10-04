import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Canje o revocación de una sesión (especificación §14). */
export class RefreshDto {
  @ApiProperty({
    required: false,
    description: 'Refresh token opaco. La web no lo envía: viaja en la cookie HttpOnly (V2 §18).',
  })
  @IsOptional()
  @IsString()
  @MinLength(16, { message: 'El token de sesión no es válido.' })
  @MaxLength(200)
  refreshToken?: string;
}
