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
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ProjectStatus, ProjectVisibility } from '@perfil/shared';
import { cleanLine, cleanText, trim, trimUniqueArray } from '../../common/validation';

export class CreateProjectDto {
  @ApiProperty({ example: 'Plataforma de tutorías' })
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

  @ApiProperty({ required: false, description: 'ID del área académica' })
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  /** V3 §21.2: una o varias áreas. `areaId` se mantiene por compatibilidad. */
  @ApiProperty({ required: false, type: [String], description: 'Áreas académicas (1 a 6)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6, { message: 'Como máximo 6 áreas.' })
  @ArrayUnique({ message: 'No repitas áreas.' })
  @IsUUID('4', { each: true, message: 'Elige áreas del catálogo.' })
  areaIds?: string[];

  /** V3 §21.1: tecnologías del catálogo, de las áreas elegidas (§4). */
  @ApiProperty({ required: false, type: [String], description: 'Tecnologías del catálogo (hasta 20)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Como máximo 20 tecnologías.' })
  @ArrayUnique({ message: 'No repitas tecnologías.' })
  @IsUUID('4', { each: true, message: 'Elige tecnologías del catálogo.' })
  skillIds?: string[];

  /** V3 §21.1: equipo de colaboración del que forma parte quien registra. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'Elige uno de tus equipos.' })
  teamId?: string | null;

  @ApiProperty({ required: false, type: [String], example: ['React', 'Node.js'] })
  @IsOptional()
  @Transform(trimUniqueArray)
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 tecnologías.' })
  @ArrayUnique({ message: 'No se permiten tecnologías duplicadas.' })
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Cada tecnología es demasiado larga.' })
  technologies?: string[];

  @ApiProperty({ enum: ProjectStatus, required: false, default: ProjectStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiProperty({ required: false, example: 'https://github.com/usuario/proyecto' })
  @IsOptional()
  @Transform(trim)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El repositorio debe ser una URL http o https válida.' },
  )
  @MaxLength(500)
  repositoryUrl?: string;

  @ApiProperty({ required: false, example: 'https://demo.example.com' })
  @IsOptional()
  @Transform(trim)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'La demo debe ser una URL http o https válida.' },
  )
  @MaxLength(500)
  demoUrl?: string;

  @ApiProperty({
    enum: ProjectVisibility,
    required: false,
    default: ProjectVisibility.PROFILE,
    description:
      'private = solo tú y tus integrantes · team = además tu equipo · teachers = además tus docentes · '
      + 'profile = visible en tu perfil · public_link = resumen público para quien tenga el enlace',
  })
  @IsOptional()
  @IsEnum(ProjectVisibility, { message: 'El nivel de visibilidad no es válido.' })
  visibility?: ProjectVisibility;
}
