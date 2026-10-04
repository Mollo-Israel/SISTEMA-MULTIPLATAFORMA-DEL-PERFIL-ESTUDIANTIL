import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { cleanText } from '../../common/validation';

/** Decisión de Dirección sobre una actividad enviada (V2 §27.3). */
export class ReviewActivityDto {
  @ApiProperty({ enum: ['approve', 'observe', 'reject'] })
  @IsIn(['approve', 'observe', 'reject'], { message: 'Elige aprobar, observar o rechazar.' })
  decision: 'approve' | 'observe' | 'reject';

  @ApiProperty({ required: false, description: 'Obligatorio al observar o rechazar.' })
  @ValidateIf((o: ReviewActivityDto) => o.decision !== 'approve' || o.comment !== undefined)
  @Transform(cleanText)
  @IsString({ message: 'Escribe la observación para quien la propuso.' })
  @MinLength(5, { message: 'Explica la observación en al menos 5 caracteres.' })
  @MaxLength(1000, { message: 'La observación no puede superar 1000 caracteres.' })
  comment?: string;
}

export class SubmitActivityDto {
  @ApiProperty({ required: false, description: 'Nota para Dirección (opcional).' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
