import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { trim } from '../../common/validation';

export class CreateProfileDto {
  @ApiProperty({ required: false, example: 5, minimum: 1, maximum: 8 })
  @IsOptional()
  @IsInt({ message: 'El semestre debe ser un número.' })
  @Min(1, { message: 'El semestre mínimo es 1.' })
  @Max(8, { message: 'El semestre máximo es 8.' })
  semester?: number;

  @ApiProperty({ required: false, example: 'Interesado en desarrollo web y datos.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'La descripción no puede superar 1000 caracteres.' })
  bio?: string;

  @ApiProperty({ required: false, type: [String], description: 'IDs de áreas académicas donde desea mejorar' })
  @IsOptional()
  @IsArray()
  @ArrayUnique({ message: 'No se permiten áreas duplicadas.' })
  @IsUUID('4', { each: true })
  improvementAreaIds?: string[];
}
