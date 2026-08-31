import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import { EvidenceType } from '@perfil/shared';
import { cleanLine, cleanText, trim } from '../../common/validation';

export class AddEvidenceDto {
  @ApiProperty({ enum: EvidenceType })
  @IsEnum(EvidenceType, { message: 'Tipo de evidencia inválido.' })
  evidenceType: EvidenceType;

  @ApiProperty({ required: false, example: 'Capturas del despliegue' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'La descripción no puede superar 300 caracteres.' })
  description?: string;

  @ApiProperty({ required: false, description: 'Ruta del archivo (cuando evidenceType=file)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  fileUrl?: string;

  @ApiProperty({ required: false, description: 'Enlace externo (cuando evidenceType=link)' })
  @IsOptional()
  @Transform(trim)
  @IsUrl({}, { message: 'El enlace debe ser una URL válida.' })
  @MaxLength(500)
  externalUrl?: string;

  @ApiProperty({ required: false, description: 'Nombre original del archivo subido' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(160)
  fileName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiProperty({ required: false, description: 'Tamaño en bytes' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5 * 1024 * 1024, { message: 'El archivo supera el máximo de 5 MB.' })
  fileSize?: number;
}
