import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OnboardingAnswerDto {
  @ApiProperty({ example: 'q01_producto_favorito' })
  @IsString()
  @MaxLength(60)
  questionCode: string;

  @ApiProperty({ type: [String], example: ['web'] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cada pregunta necesita al menos una opción.' })
  @ArrayMaxSize(10, { message: 'Demasiadas opciones para una sola pregunta.' })
  @ArrayUnique({ message: 'No se permiten opciones repetidas.' })
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  optionCodes: string[];
}

export class SubmitOnboardingDto {
  @ApiProperty({ type: [OnboardingAnswerDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'El cuestionario no puede enviarse vacío.' })
  @ArrayMaxSize(30, { message: 'Demasiadas respuestas.' })
  @ValidateNested({ each: true })
  @Type(() => OnboardingAnswerDto)
  answers: OnboardingAnswerDto[];
}

export class ConfirmOnboardingDto {
  /**
   * Áreas que el estudiante decide incorporar.
   *
   * Opcional y puede venir vacío: «ninguna de estas» es una respuesta
   * legítima y cierra el cuestionario igual (§16).
   */
  @ApiProperty({
    type: [String],
    required: false,
    description: 'IDs de las áreas sugeridas que desea incorporar como intereses.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'El cuestionario sugiere como máximo 5 áreas.' })
  @ArrayUnique({ message: 'No se permiten áreas repetidas.' })
  @IsUUID('4', { each: true })
  academicAreaIds?: string[];
}
