import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { UNIVERSITY_CODE_PATTERN, normalizeUniversityCode } from '@perfil/shared';

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

  @ApiProperty({ required: false, example: 'EST-38DJ1HA' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeUniversityCode(value) : value))
  @IsString()
  @Matches(UNIVERSITY_CODE_PATTERN, {
    message: 'Formato del código: EST- y 7 letras o números (por ejemplo EST-38DJ1HA).',
  })
  universityCode?: string;
}
