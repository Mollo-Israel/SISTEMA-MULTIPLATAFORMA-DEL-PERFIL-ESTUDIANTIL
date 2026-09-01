import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ActivityModality, ActivityStatus, ActivityType } from '@perfil/shared';
import { IsNotBeforeField, trim } from '../../common/validation';

/**
 * Filtros de consulta de actividades (RF8).
 *
 * El documento pide filtros opcionales por categoria, area, modalidad y fecha.
 * Se conservan ademas los filtros por tipo y estado que ya existian y que la
 * interfaz movil aprovecha.
 */
export class QueryActivitiesDto {
  @ApiPropertyOptional({ enum: ActivityType, description: 'Académica o extracurricular' })
  @IsOptional()
  @IsEnum(ActivityType, { message: 'El tipo de actividad no es válido.' })
  type?: ActivityType;

  @ApiPropertyOptional({ description: 'ID de la categoría del catálogo' })
  @IsOptional()
  @IsUUID('4', { message: 'La categoría indicada no es válida.' })
  categoryId?: string;

  @ApiPropertyOptional({ enum: ActivityStatus })
  @IsOptional()
  @IsEnum(ActivityStatus, { message: 'El estado de actividad no es válido.' })
  status?: ActivityStatus;

  @ApiPropertyOptional({ enum: ActivityModality, description: 'Presencial, virtual o híbrida' })
  @IsOptional()
  @IsEnum(ActivityModality, { message: 'La modalidad no es válida.' })
  modality?: ActivityModality;

  @ApiPropertyOptional({ description: 'Filtrar por área académica' })
  @IsOptional()
  @IsUUID('4', { message: 'El área académica indicada no es válida.' })
  areaId?: string;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Solo actividades con fecha igual o posterior',
  })
  @IsOptional()
  @Transform(trim)
  @IsISO8601({}, { message: 'La fecha desde no es válida.' })
  fromDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Solo actividades con fecha igual o anterior',
  })
  @IsOptional()
  @Transform(trim)
  @IsISO8601({}, { message: 'La fecha hasta no es válida.' })
  @ValidateIf((o: QueryActivitiesDto) => !!o.fromDate)
  @IsNotBeforeField('fromDate', {
    message: 'La fecha hasta no puede ser anterior a la fecha desde.',
  })
  toDate?: string;
}
