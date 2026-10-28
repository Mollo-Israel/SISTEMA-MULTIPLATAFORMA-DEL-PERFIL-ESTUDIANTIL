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
  ValidateIf,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { LearningResourceStatus, LearningResourceType } from '@perfil/shared';
import { IsMeaningfulText } from '../../common/validation';

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
  @IsMeaningfulText('El título')
  title: string;

  @ApiProperty({ example: 'Cisco Networking Academy' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'Indique quién publica el recurso.' })
  @MaxLength(160, { message: 'El proveedor no puede superar 160 caracteres.' })
  @IsMeaningfulText('Quién publica')
  provider: string;

  /** V5-13: enlace o archivo; al menos uno de los dos (lo exige el servicio). */
  @ApiProperty({ example: 'https://www.netacad.com/courses/networking', required: false })
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace debe ser una URL http o https válida.' },
  )
  @MaxLength(500, { message: 'El enlace no puede superar 500 caracteres.' })
  url?: string;

  /** V5-13: archivo subido (PDF o imagen, hasta 10 MB). Para video, usa un enlace. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o: { fileId?: string | null }) => o.fileId !== null)
  @IsUUID('4', { message: 'El archivo no es válido.' })
  fileId?: string | null;

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

  /** V3.2 §35: áreas del recurso (la primera es la principal). */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6, { message: 'Como máximo 6 áreas.' })
  @IsUUID('4', { each: true, message: 'Área no válida.' })
  areaIds?: string[];

  /** V3.2 §35: imagen opcional (id de un archivo subido). `null` la quita. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o: { imageFileId?: string | null }) => o.imageFileId !== null)
  @IsUUID('4', { message: 'La imagen no es válida.' })
  imageFileId?: string | null;

  /** V5 §8.3: criterio opcional de «recurso completado». `null` lo quita. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o: { criterionId?: string | null }) => o.criterionId !== null)
  @IsUUID('4', { message: 'El criterio no es válido.' })
  criterionId?: string | null;

  /** V4.1 A41-014: semestres a los que va dirigido (vacío = toda la carrera; un docente, los suyos). */
  @ApiProperty({ required: false, type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true, message: 'Semestre no válido.' })
  @Min(1, { each: true })
  @Max(10, { each: true })
  semesterScope?: number[];
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
  @IsMeaningfulText('El título')
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'El proveedor no puede quedar vacío.' })
  @MaxLength(160)
  @IsMeaningfulText('Quién publica')
  provider?: string;

  /** V5-13: null quita el enlace (si queda un archivo). */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o: { url?: string | null }) => o.url !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace debe ser una URL http o https válida.' },
  )
  @MaxLength(500)
  url?: string | null;

  /** V5-13: null quita el archivo (si queda un enlace). */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o: { fileId?: string | null }) => o.fileId !== null)
  @IsUUID('4', { message: 'El archivo no es válido.' })
  fileId?: string | null;

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

  /** V3.2 §35: áreas del recurso (la primera es la principal). */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6, { message: 'Como máximo 6 áreas.' })
  @IsUUID('4', { each: true, message: 'Área no válida.' })
  areaIds?: string[];

  /** V3.2 §35: imagen opcional (id de un archivo subido). `null` la quita. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o: { imageFileId?: string | null }) => o.imageFileId !== null)
  @IsUUID('4', { message: 'La imagen no es válida.' })
  imageFileId?: string | null;

  /** V5 §8.3: criterio opcional de «recurso completado». `null` lo quita. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o: { criterionId?: string | null }) => o.criterionId !== null)
  @IsUUID('4', { message: 'El criterio no es válido.' })
  criterionId?: string | null;

  /** V5-6 (§8.2): semestres a los que va dirigido; vacío = toda la carrera. */
  @ApiProperty({ required: false, type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true, message: 'Semestre no válido.' })
  @Min(1, { each: true })
  @Max(10, { each: true })
  semesterScope?: number[];
}

/** V4.1 A41-014 (§7, §9.4): decisión de Dirección sobre la propuesta de un docente. */
export class ReviewLearningResourceDto {
  @ApiProperty({ enum: ['approve', 'observe', 'reject'] })
  @IsIn(['approve', 'observe', 'reject'], { message: 'Decisión no válida.' })
  decision: 'approve' | 'observe' | 'reject';

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(500)
  comment?: string;
}
