import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EvidenceType } from '@perfil/shared';
import { cleanText, trim } from '../../common/validation';

/**
 * Alta de una evidencia academica (RF11, §27).
 *
 * Una evidencia es un enlace o un archivo previamente subido a POST /uploads.
 *
 * El archivo se nombra por su identificador, no por su URL. Antes se
 * enviaban `fileUrl`, `fileName`, `mimeType` y `fileSize` tal cual los
 * devolvia la subida, y nada comprobaba su procedencia: bastaba con enviar
 * la URL de otra persona para adjuntar su archivo a una evidencia propia y,
 * como la autorizacion de descarga se resuelve mirando de quien es la
 * evidencia, quedar autorizado a leerlo. §27 advierte exactamente de ese
 * patron.
 *
 * Ahora el servidor resuelve los metadatos a partir del identificador, que
 * ademas tiene dueno.
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
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace debe ser una URL http o https válida.' },
  )
  @MaxLength(500, { message: 'El enlace es demasiado largo.' })
  externalUrl?: string;

  @ApiProperty({
    required: false,
    description:
      'Identificador devuelto por POST /uploads. Obligatorio cuando evidenceType = file. '
      + 'Solo se aceptan archivos subidos por quien crea la evidencia.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo debe identificarse por el id que devolvió la subida.' })
  storedFileId?: string;

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
