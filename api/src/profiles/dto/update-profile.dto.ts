import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { cleanText } from '../../common/validation';

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 6, minimum: 1, maximum: 8 })
  @IsOptional()
  @IsInt({ message: 'El semestre debe ser un número.' })
  @Min(1, { message: 'El semestre mínimo es 1.' })
  @Max(8, { message: 'El semestre máximo es 8.' })
  semester?: number;

  @ApiProperty({ required: false, example: 'Enfocado en backend y bases de datos.' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(1000, { message: 'La descripción no puede superar 1000 caracteres.' })
  bio?: string;

  @ApiProperty({ required: false, type: [String], description: 'IDs de áreas académicas donde desea mejorar' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 áreas a mejorar.' })
  @ArrayUnique({ message: 'No se permiten áreas duplicadas.' })
  @IsUUID('4', { each: true })
  improvementAreaIds?: string[];
}
