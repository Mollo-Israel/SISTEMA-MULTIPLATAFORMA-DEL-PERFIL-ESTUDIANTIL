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
} from 'class-validator';
import {
  ActivityCategory,
  ActivityModality,
  ActivityStatus,
  ActivityType,
} from '@perfil/shared';
import { trim, trimUniqueArray } from '../../common/validation';

export class CreateActivityDto {
  @ApiProperty({ example: 'Taller de NestJS' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MaxLength(160, { message: 'El título no puede superar 160 caracteres.' })
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000, { message: 'La descripción no puede superar 2000 caracteres.' })
  description?: string;

  @ApiProperty({ enum: ActivityType })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({ enum: ActivityCategory })
  @IsEnum(ActivityCategory)
  category: ActivityCategory;

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
  @Transform(trim)
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
  @IsUrl()
  @MaxLength(500)
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
}
