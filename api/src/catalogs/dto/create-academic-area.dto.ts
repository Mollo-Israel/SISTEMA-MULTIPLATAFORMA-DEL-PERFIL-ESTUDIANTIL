import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim, trimUniqueArray } from '../../common/validation';

export class CreateAcademicAreaDto {
  @ApiProperty({ example: 'Computación en la Nube' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del área es obligatorio.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede superar 255 caracteres.' })
  description?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @Transform(trimUniqueArray)
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 etiquetas.' })
  @ArrayUnique({ message: 'No se permiten etiquetas duplicadas.' })
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Cada etiqueta es demasiado larga.' })
  tags?: string[];
}
