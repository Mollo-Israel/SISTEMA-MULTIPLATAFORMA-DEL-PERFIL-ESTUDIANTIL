import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { LearningResourceStatus, LearningResourceType } from '@perfil/shared';

const limpiar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

/**
 * Alta de un recurso en el catalogo controlado (§61).
 *
 * `url` solo admite http y https. Un catalogo que aceptara `javascript:` o
 * `file:` seria una forma elegante de servir enlaces peligrosos desde una
 * pantalla en la que el estudiante confia.
 */
export class CreateLearningResourceDto {
  @ApiProperty({ example: 'Curso de fundamentos de redes' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MaxLength(200, { message: 'El título no puede superar 200 caracteres.' })
  title: string;

  @ApiProperty({ example: 'Cisco Networking Academy' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'Indique quién publica el recurso.' })
  @MaxLength(160, { message: 'El proveedor no puede superar 160 caracteres.' })
  provider: string;

  @ApiProperty({ example: 'https://www.netacad.com/courses/networking' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace debe ser una URL http o https válida.' },
  )
  @MaxLength(500, { message: 'El enlace no puede superar 500 caracteres.' })
  url: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede superar 500 caracteres.' })
  description?: string;

  @ApiProperty({ example: '9e3f1c2a-0000-4000-8000-000000000000' })
  @IsUUID('4', { message: 'Seleccione un área académica del catálogo.' })
  academicAreaId: string;

  @ApiProperty({ enum: LearningResourceType })
  @IsEnum(LearningResourceType, { message: 'Tipo de recurso no válido.' })
  resourceType: LearningResourceType;

  /** §61: `skills[]`. Es lo que permite recomendarlo por habilidad y no solo por área. */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 habilidades por recurso.' })
  @ArrayUnique({ message: 'No repita habilidades.' })
  @IsUUID('4', { each: true })
  skillIds?: string[];
}

/**
 * Edicion de un recurso.
 *
 * Todo es opcional salvo que no hay borrado: retirar un recurso es ponerlo en
 * `inactive`, porque §61 pide conservarlo historicamente.
 */
export class UpdateLearningResourceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'El título no puede quedar vacío.' })
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'El proveedor no puede quedar vacío.' })
  @MaxLength(160)
  provider?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace debe ser una URL http o https válida.' },
  )
  @MaxLength(500)
  url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  academicAreaId?: string;

  @ApiProperty({ enum: LearningResourceType, required: false })
  @IsOptional()
  @IsEnum(LearningResourceType, { message: 'Tipo de recurso no válido.' })
  resourceType?: LearningResourceType;

  @ApiProperty({ enum: LearningResourceStatus, required: false })
  @IsOptional()
  @IsEnum(LearningResourceStatus, { message: 'Estado no válido.' })
  status?: LearningResourceStatus;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 habilidades por recurso.' })
  @ArrayUnique({ message: 'No repita habilidades.' })
  @IsUUID('4', { each: true })
  skillIds?: string[];
}
