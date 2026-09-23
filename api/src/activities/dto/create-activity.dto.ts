import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ActivityModality,
  ActivityStatus,
  ActivityType,
  RegistrationMode,
} from '@perfil/shared';
import { cleanLine, cleanText, trim, trimUniqueArray } from '../../common/validation';

export class CreateActivityDto {
  @ApiProperty({ example: 'Taller de NestJS' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres.' })
  @MaxLength(160, { message: 'El título no puede superar 160 caracteres.' })
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(2000, { message: 'La descripción no puede superar 2000 caracteres.' })
  description?: string;

  @ApiProperty({ enum: ActivityType })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({
    description: 'ID de la categoría del catálogo administrable (RF4).',
    example: '9e3f1c2a-0000-4000-8000-000000000000',
  })
  @IsUUID('4', { message: 'Debe seleccionar una categoría del catálogo.' })
  categoryId: string;

  @ApiProperty({ enum: ActivityModality, required: false, default: ActivityModality.PRESENCIAL })
  @IsOptional()
  @IsEnum(ActivityModality)
  modality?: ActivityModality;

  @ApiProperty({ required: false, example: '2026-06-15T15:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  activityDate?: string;

  @ApiProperty({ required: false, example: 'Aula 301' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(200, { message: 'La ubicación no puede superar 200 caracteres.' })
  location?: string;

  @ApiProperty({ required: false, example: 30, minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt({ message: 'El cupo debe ser un número entero.' })
  @Min(1, { message: 'El cupo mínimo es 1.' })
  @Max(1000, { message: 'El cupo máximo es 1000.' })
  capacity?: number;

  @ApiProperty({ required: false, description: 'ID del área académica' })
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @Transform(trimUniqueArray)
  @IsArray()
  @ArrayMaxSize(15, { message: 'Máximo 15 etiquetas.' })
  @ArrayUnique({ message: 'No se permiten etiquetas duplicadas.' })
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Cada etiqueta es demasiado larga.' })
  tags?: string[];

  @ApiProperty({ required: false, example: 'https://evento.example.com' })
  @IsOptional()
  @Transform(trim)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace externo debe ser una URL http o https válida.' },
  )
  @MaxLength(500, { message: 'El enlace externo es demasiado largo.' })
  externalUrl?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  evidenceRequired?: boolean;

  @ApiProperty({
    enum: ActivityStatus,
    required: false,
    default: ActivityStatus.DRAFT,
    description: 'Estado inicial (por defecto draft)',
  })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  /** Fin de la actividad (§22, `end_at`). */
  @ApiProperty({ required: false, example: '2026-04-12T18:00:00.000Z' })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de fin no es válida.' })
  endAt?: string;

  /**
   * Semestres a los que va dirigida (§22, `semester_scope`).
   *
   * Para un docente no es informativo: delimita qué puede gestionar. El
   * servidor rechaza los semestres fuera de su alcance habilitado.
   */
  @ApiProperty({ required: false, type: [Number], example: [4, 5] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8, { message: 'La carrera tiene 8 semestres.' })
  @ArrayUnique({ message: 'No repita semestres.' })
  @IsInt({ each: true, message: 'Cada semestre debe ser un número.' })
  @Min(1, { each: true, message: 'El semestre mínimo es 1.' })
  @Max(8, { each: true, message: 'El semestre máximo es 8.' })
  semesterScope?: number[];

  /** Habilidades que la actividad trabaja (§22, §73.3). */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 habilidades por actividad.' })
  @ArrayUnique({ message: 'No repita habilidades.' })
  @IsUUID('4', { each: true })
  skillIds?: string[];

  @ApiProperty({ enum: RegistrationMode, required: false, default: RegistrationMode.OPEN })
  @IsOptional()
  @IsEnum(RegistrationMode, { message: 'Modo de inscripción no válido.' })
  registrationMode?: RegistrationMode;

  /** Requisitos previos (§22, `requirements`). */
  @ApiProperty({ required: false, example: 'Conocer fundamentos de JavaScript.' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(500, { message: 'Los requisitos no pueden superar 500 caracteres.' })
  requirements?: string;
}
