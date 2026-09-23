import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { EvidenceType } from '@perfil/shared';
import { cleanText, trim } from '../../common/validation';

/**
 * Evidencia de un proyecto (§35, §27).
 *
 * El archivo se nombra por su identificador, no por su URL. Esta ruta se había
 * quedado con el patrón antiguo —`fileUrl` y sus metadatos sueltos— después de
 * que la ruta general de evidencias lo abandonara: permitía adjuntar el
 * archivo de otra persona, que es exactamente contra lo que advierte §27.
 */
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

  @ApiProperty({
    required: false,
    description:
      'Identificador devuelto por POST /uploads (cuando evidenceType=file). '
      + 'Solo se aceptan archivos subidos por quien adjunta la evidencia.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo debe identificarse por el id que devolvió la subida.' })
  storedFileId?: string;

  @ApiProperty({ required: false, description: 'Enlace externo (cuando evidenceType=link)' })
  @IsOptional()
  @Transform(trim)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace debe ser una URL http o https válida.' },
  )
  @MaxLength(500)
  externalUrl?: string;
}
