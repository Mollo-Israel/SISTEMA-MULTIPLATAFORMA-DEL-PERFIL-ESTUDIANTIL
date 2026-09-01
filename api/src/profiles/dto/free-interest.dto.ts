import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { cleanLine, cleanText } from '../../common/validation';

/**
 * Interes declarado en texto libre (RF5).
 *
 * Es distinto de un area de preferencia: aqui el estudiante escribe el tema con
 * sus palabras y no tiene por que existir en el catalogo de areas academicas.
 */
export class CreateFreeInterestDto {
  @ApiProperty({ example: 'Desarrollo de videojuegos' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El interés no puede estar vacío.' })
  @MinLength(3, { message: 'El interés debe tener al menos 3 caracteres.' })
  @MaxLength(120, { message: 'El interés no puede superar 120 caracteres.' })
  name: string;

  @ApiProperty({
    required: false,
    example: 'Motores 2D, diseño de niveles y programación de mecánicas.',
  })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'La descripción no puede superar 300 caracteres.' })
  description?: string;
}

export class UpdateFreeInterestDto extends PartialType(CreateFreeInterestDto) {}
