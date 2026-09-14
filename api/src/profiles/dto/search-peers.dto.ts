import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { cleanLine } from '../../common/validation';

/**
 * Busqueda de companeros por nombre (RF14, y base de RF18).
 *
 * Exige un termino de al menos dos caracteres a proposito: sirve para encontrar
 * a alguien que el estudiante ya conoce, no para recorrer el listado completo de
 * estudiantes de la carrera.
 */
export class SearchPeersDto {
  @ApiProperty({ example: 'Luis', minLength: 2, maxLength: 60 })
  @Transform(cleanLine)
  @IsString({ message: 'Indique un nombre para buscar.' })
  @MinLength(2, { message: 'Escriba al menos 2 caracteres para buscar.' })
  @MaxLength(60, { message: 'La búsqueda no puede superar 60 caracteres.' })
  search: string;
}
