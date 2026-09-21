import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { cleanText } from '../../common/validation';

/**
 * Alta del perfil por parte del estudiante.
 *
 * No lleva `semester` ni `universityCode`: son datos institucionales y §17.1
 * los declara no editables por el estudiante. Llegan por importación de padrón
 * o los fija el administrador. Enviarlos aquí devuelve 400, porque el
 * ValidationPipe global rechaza campos no declarados.
 */
export class CreateProfileDto {
  @ApiProperty({ required: false, example: 'Interesado en desarrollo web y datos.' })
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
