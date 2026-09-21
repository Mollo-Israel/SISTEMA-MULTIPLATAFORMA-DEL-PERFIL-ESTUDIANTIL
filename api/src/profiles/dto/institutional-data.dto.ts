import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { cleanLine } from '../../common/validation';

/**
 * Datos institucionales de un estudiante (§17.1).
 *
 * Solo el administrador los fija. Normalmente llegan por importación de
 * padrón; este endpoint cubre el caso de la cuenta dada de alta a mano y el de
 * la corrección puntual, sin obligar a reimportar el padrón entero.
 *
 * El estudiante no puede tocarlos: de poder, bastaría declararse de otro
 * semestre para entrar o salir del alcance académico de un docente.
 */
export class SetInstitutionalDataDto {
  @ApiProperty({ required: false, example: 5, minimum: 1, maximum: 8 })
  @IsOptional()
  @IsInt({ message: 'El semestre debe ser un número.' })
  @Min(1, { message: 'El semestre mínimo es 1.' })
  @Max(8, { message: 'El semestre máximo es 8.' })
  semester?: number;

  @ApiProperty({ required: false, example: '202100123' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MinLength(3, { message: 'El código universitario es demasiado corto.' })
  @MaxLength(30, { message: 'El código universitario no puede superar 30 caracteres.' })
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'El código universitario solo admite letras, números, punto, guion y guion bajo.',
  })
  universityCode?: string;
}
