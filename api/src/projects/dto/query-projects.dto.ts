import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ProjectStatus } from '@perfil/shared';
import { cleanLine } from '../../common/validation';

/**
 * Filtros del portafolio institucional que consulta el docente (RF15).
 * Solo los que el requerimiento respalda: estado, area, tecnologia, semestre y
 * busqueda por estudiante o titulo. No es un buscador avanzado.
 */
export class QueryProjectsDto {
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'El estado de proyecto no es válido.' })
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Filtrar por área académica' })
  @IsOptional()
  @IsUUID('4', { message: 'El área académica indicada no es válida.' })
  areaId?: string;

  @ApiPropertyOptional({ example: 'React', description: 'Tecnología utilizada' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(40)
  technology?: string;

  @ApiPropertyOptional({ example: 5, description: 'Semestre del estudiante responsable' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt({ message: 'El semestre debe ser un número entero.' })
  @Min(1, { message: 'El semestre mínimo es 1.' })
  @Max(8, { message: 'El semestre máximo es 8.' })
  semester?: number;

  @ApiPropertyOptional({ description: 'Busca por título del proyecto o nombre del estudiante' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(120)
  search?: string;
}
