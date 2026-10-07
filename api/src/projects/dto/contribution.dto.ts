import { PROJECT_ROLES } from '@perfil/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength, IsIn, MinLength } from 'class-validator';
import { cleanLine, cleanText } from '../../common/validation';

/**
 * Contribución de un integrante, confirmada por él mismo (§33, §34).
 *
 * Las tecnologías son las **suyas**, no las del proyecto. §34 lo ilustra: un
 * proyecto de React, NestJS, PostgreSQL y Docker puede tener un integrante que
 * solo tocó React. Atribuirle las cuatro sería inventarle experiencia.
 */
export class ConfirmContributionDto {
  @ApiProperty({ required: false, example: 'Implementé la interfaz de inscripción.' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(1000, { message: 'La contribución no puede superar 1000 caracteres.' })
  contribution?: string;

  @ApiProperty({ required: false, example: 'Frontend' })
  @IsOptional()
  @Transform(cleanLine)
  @IsIn([...PROJECT_ROLES], { message: `El rol debe ser uno de: ${PROJECT_ROLES.join(', ')}.` })
  role?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Tecnologías que usted usó, del catálogo. No las del proyecto entero.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 tecnologías por integrante.' })
  @ArrayUnique({ message: 'No repita tecnologías.' })
  @IsUUID('4', { each: true })
  skillIds?: string[];
}

/**
 * Propuesta del responsable sobre un integrante (§33).
 *
 * Propone; no atribuye. Guardarla retira la confirmación anterior para que el
 * integrante vuelva a revisarla.
 */
export class ProposeContributionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(1000, { message: 'La contribución no puede superar 1000 caracteres.' })
  contribution?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanLine)
  @IsIn([...PROJECT_ROLES], { message: `El rol debe ser uno de: ${PROJECT_ROLES.join(', ')}.` })
  role?: string;
}

/** V3 §30: el integrante pide corregir lo que le propusieron. */
export class RequestCorrectionDto {
  @ApiProperty({ example: 'No hice el backend: me encargué de las pruebas.' })
  @Transform(cleanText)
  @IsString()
  @MinLength(10, { message: 'Explica qué hay que corregir (al menos 10 caracteres).' })
  @MaxLength(500, { message: 'La nota no puede superar 500 caracteres.' })
  note: string;
}
