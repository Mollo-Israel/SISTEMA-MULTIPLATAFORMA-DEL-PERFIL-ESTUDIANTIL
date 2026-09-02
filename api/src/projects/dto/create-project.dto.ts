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
  @IsUrl({}, { message: 'El repositorio debe ser una URL válida.' })
  @MaxLength(500)
  repositoryUrl?: string;

  @ApiProperty({ required: false, example: 'https://demo.example.com' })
  @IsOptional()
  @Transform(trim)
  @IsUrl({}, { message: 'La demo debe ser una URL válida.' })
  @MaxLength(500)
  demoUrl?: string;

  @ApiProperty({
    enum: ProjectVisibility,
    required: false,
    default: ProjectVisibility.PROFILE,
    description:
      'private = solo tú y tus integrantes · profile = visible en tu perfil · teachers = además consultable por tus docentes',
  })
  @IsOptional()
  @IsEnum(ProjectVisibility, { message: 'El nivel de visibilidad no es válido.' })
  visibility?: ProjectVisibility;
}
