import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  cleanLine,
  cleanText,
  CODE_MSG,
  CODE_RE,
  IsCatalogName,
  IsTagList,
  lowerTags,
  trimLower,
} from '../../common/validation';

/**
 * Alta de un área académica.
 *
 * Obligatorios: el nombre y al menos una etiqueta. Las etiquetas son las
 * palabras con las que el motor reconoce el área en proyectos, actividades y
 * recursos («sql», «react», «redes»): un área sin etiquetas existe en el
 * catálogo pero el motor no la encuentra. La descripción es opcional.
 */
export class CreateAcademicAreaDto {
  @ApiProperty({ example: 'Computación en la Nube' })
  @Transform(cleanLine)
  @IsString({ message: 'El nombre del área es obligatorio.' })
  @IsNotEmpty({ message: 'El nombre del área es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  @IsCatalogName()
  name: string;

  @ApiProperty({
    required: false,
    example: 'computacion_en_la_nube',
    description: 'Si se omite, se genera a partir del nombre.',
  })
  @IsOptional()
  @Transform(trimLower)
  @IsString()
  @Matches(CODE_RE, { message: CODE_MSG })
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede superar 255 caracteres.' })
  description?: string;

  @ApiProperty({ type: [String], example: ['aws', 'docker', 'kubernetes'] })
  @Transform(lowerTags)
  @IsArray({ message: 'Añada al menos una etiqueta.' })
  @ArrayMinSize(1, {
    message: 'Añada al menos una etiqueta: son las palabras con las que el motor reconoce el área.',
  })
  @ArrayMaxSize(20, { message: 'Máximo 20 etiquetas.' })
  @ArrayUnique({ message: 'No se permiten etiquetas duplicadas.' })
  @IsTagList()
  tags: string[];
}
