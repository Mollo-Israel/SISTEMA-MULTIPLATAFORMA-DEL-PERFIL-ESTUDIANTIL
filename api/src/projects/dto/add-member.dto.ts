import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trim } from '../../common/validation';

export class AddMemberDto {
  @ApiProperty({ description: 'ID del usuario integrante' })
  @IsUUID('4', { message: 'Integrante inválido.' })
  userId: string;

  @ApiProperty({ required: false, example: 'Desarrollador backend' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80, { message: 'El rol no puede superar 80 caracteres.' })
  role?: string;

  @ApiProperty({ required: false, example: 'Implementó la API y la base de datos.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'El aporte no puede superar 500 caracteres.' })
  contribution?: string;
}
