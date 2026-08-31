import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EvidenceType } from '@perfil/shared';
import { cleanLine, cleanText, trim } from '../../common/validation';

/**
 * Alta de una evidencia academica (RF11).
 *
 * Una evidencia es un enlace o un archivo previamente subido a POST /uploads.
 * Se asocia, segun corresponda, a un proyecto, a una actividad o a un area.
 */
export class CreateEvidenceDto {
  @ApiProperty({ enum: EvidenceType, description: 'link = enlace externo · file = archivo subido' })
  @IsEnum(EvidenceType, { message: 'Tipo de evidencia inválido.' })
  evidenceType: EvidenceType;

  @ApiProperty({ required: false, example: 'Capturas del despliegue en producción' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'La descripción no puede superar 300 caracteres.' })
  description?: string;

  @ApiProperty({ required: false, description: 'Obligatorio cuando evidenceType = link' })
  @IsOptional()
  @Transform(trim)
  @IsUrl({}, { message: 'El enlace debe ser una URL válida.' })
  @MaxLength(500, { message: 'El enlace es demasiado largo.' })
  externalUrl?: string;

  @ApiProperty({
    required: false,
    description: 'Referencia devuelta por POST /uploads. Obligatorio cuando evidenceType = file',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  fileUrl?: string;

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

  @ApiProperty({ required: false, description: 'Proyecto que respalda la evidencia' })
  @IsOptional()
  @IsUUID('4')
  projectId?: string;

  @ApiProperty({ required: false, description: 'Actividad que respalda la evidencia' })
  @IsOptional()
  @IsUUID('4')
  activityId?: string;

  @ApiProperty({ required: false, description: 'Área académica a la que corresponde' })
  @IsOptional()
  @IsUUID('4')
  academicAreaId?: string;
}

export class UpdateEvidenceDto extends PartialType(CreateEvidenceDto) {}
