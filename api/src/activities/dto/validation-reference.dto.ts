import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { cleanLine, cleanText } from '../../common/validation';

/**
 * Referencia de validación de una oportunidad externa (V3 §17).
 *
 * Todos los campos son opcionales y admiten `null` para borrarlos: la
 * referencia ayuda, nunca es requisito.
 */
export class SaveValidationReferenceDto {
  @ApiProperty({ required: false, nullable: true, example: 'CCNA: Introduction to Networks' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(200, { message: 'El nombre del curso no puede superar 200 caracteres.' })
  expectedCourseName?: string | null;

  /** `#` dígito · `@` letra · `*` varios caracteres; el resto, literal. */
  @ApiProperty({ required: false, nullable: true, example: 'NA-####-@@*' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(80, { message: 'El patrón no puede superar 80 caracteres.' })
  credentialIdPattern?: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Certificado de ejemplo: id devuelto por POST /uploads' })
  @IsOptional()
  @IsUUID('4', { message: 'El ejemplo debe identificarse por el id que devolvió la subida.' })
  sampleStoredFileId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'Las notas no pueden superar 300 caracteres.' })
  notes?: string | null;
}

/**
 * V7.1 D03 · «Adjuntar/actualizar certificado modelo» (solo Dirección).
 * El archivo lo sube Dirección; el motivo queda en la versión y en la auditoría.
 */
export class UpdateReferenceModelDto {
  @ApiProperty({ description: 'Certificado modelo: id devuelto por POST /uploads' })
  @IsUUID('4', { message: 'El modelo debe identificarse por el id que devolvió la subida.' })
  storedFileId: string;

  @ApiProperty({ example: 'El docente entregó el modelo oficial después de la aprobación.' })
  @Transform(cleanText)
  @IsString()
  @MinLength(10, { message: 'Explica el motivo (al menos 10 caracteres).' })
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres.' })
  reason: string;
}
