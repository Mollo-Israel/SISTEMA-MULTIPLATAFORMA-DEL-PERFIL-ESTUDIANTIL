import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { cleanLine, cleanText, IsNotFutureDate, trim } from '../../common/validation';

export class CreateExternalCertificateDto {
  @ApiProperty({ example: 'Certified JavaScript Developer' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del certificado es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(200, { message: 'El nombre no puede superar 200 caracteres.' })
  certificateName: string;

  @ApiProperty({ example: 'Plataforma Externa', description: 'Entidad emisora (externa al sistema)' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'La entidad emisora es obligatoria.' })
  @MinLength(2, { message: 'La entidad emisora debe tener al menos 2 caracteres.' })
  @MaxLength(160, { message: 'La entidad emisora no puede superar 160 caracteres.' })
  issuer: string;

  /**
   * Enlace de verificación del emisor (§30).
   *
   * Si responde y es coherente con lo declarado, el certificado sube a
   * CORROBORATED. El sistema lo consulta con las protecciones de §31: nunca
   * alcanza direcciones internas ni el servicio de metadata de la nube.
   */
  @ApiProperty({ required: false, example: 'https://emisor.example.com/cert/123' })
  @IsOptional()
  @Transform(trim)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace del certificado debe ser una URL http o https válida.' },
  )
  @MaxLength(500)
  certificateUrl?: string;

  /** Identificador que el emisor imprime en el documento (§30). */
  @ApiProperty({ required: false, example: 'AF-2026-00417' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(80, { message: 'El identificador de credencial es demasiado largo.' })
  @Matches(/^[A-Za-z0-9._\/-]+$/, {
    message: 'El identificador de credencial solo admite letras, números, punto, guion y barra.',
  })
  credentialId?: string;

  @ApiProperty({ required: false, example: '2026-01-15' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de emisión no es válida.' })
  @IsNotFutureDate({ message: 'La fecha de emisión no puede ser futura.' })
  issueDate?: string;

  @ApiProperty({ required: false, example: 'Curso de 40 horas sobre pruebas automatizadas.' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'La descripción no puede superar 300 caracteres.' })
  description?: string;

  @ApiProperty({ required: false, description: 'Área académica a la que corresponde' })
  @IsOptional()
  @IsUUID('4')
  academicAreaId?: string;

  /**
   * Archivo del certificado, por su identificador (§27).
   *
   * Solo se aceptan archivos subidos por quien registra el certificado: la
   * URL suelta que se enviaba antes permitia adjuntar el documento de otra
   * persona.
   */
  @ApiProperty({
    required: false,
    description: 'Identificador del archivo devuelto por POST /uploads',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo debe identificarse por el id que devolvió la subida.' })
  storedFileId?: string;

  /** V2 §41: tecnologías del catálogo que el certificado acredita. */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15, { message: 'Como máximo 15 tecnologías por certificado.' })
  @ArrayUnique({ message: 'No repitas tecnologías.' })
  @IsUUID('4', { each: true, message: 'Elige tecnologías del catálogo.' })
  skillIds?: string[];
}
