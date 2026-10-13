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
 * Obligatorios: el nombre y al menos una etiqueta. V3.2 §10: las etiquetas son
 * metadata que describe el área y ayuda a sugerirla al clasificar habilidades
 * nuevas; no suman puntaje ni afinidad (la afinidad sale del contexto
 * explícito de cada experiencia, §11.5). La descripción es opcional.
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

  @ApiProperty({
    type: [String],
    example: ['infraestructura', 'despliegue', 'escalabilidad'],
    description: 'Metadata para clasificar y sugerir; no suma afinidad (V3.2 §10).',
  })
  @Transform(lowerTags)
  @IsArray({ message: 'Añada al menos una etiqueta.' })
  @ArrayMinSize(1, {
    message: 'Añada al menos una etiqueta: son las palabras que describen el área y ayudan a sugerirla.',
  })
  @ArrayMaxSize(20, { message: 'Máximo 20 etiquetas.' })
  @ArrayUnique({ message: 'No se permiten etiquetas duplicadas.' })
  @IsTagList()
  tags: string[];
}
