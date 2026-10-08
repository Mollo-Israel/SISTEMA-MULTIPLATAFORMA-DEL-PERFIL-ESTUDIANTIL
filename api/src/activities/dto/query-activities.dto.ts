import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { ActivityModality, ActivityOrigin, ActivityStatus, ActivityType } from '@perfil/shared';
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

  @ApiPropertyOptional({ description: 'Filtrar por área académica (cualquiera de sus áreas)' })
  @IsOptional()
  @IsUUID('4', { message: 'El área académica indicada no es válida.' })
  areaId?: string;

  @ApiPropertyOptional({ enum: ActivityOrigin, description: 'Interna o externa (V3 §12)' })
  @IsOptional()
  @IsEnum(ActivityOrigin, { message: 'El origen debe ser interno o externo.' })
  originType?: ActivityOrigin;

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

  /*
   * V3 BATCH 23 · Paginación. Sin `limit` la respuesta es la lista completa,
   * como siempre. Con `limit` es una página `{ items, total, limit, offset }`
   * con lo más próximo primero: una lista sin tope crecía con cada semestre.
   */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, description: 'Tamaño de página (activa la paginación)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El tamaño de página debe ser un número.' })
  @Min(1, { message: 'El tamaño de página mínimo es 1.' })
  @Max(100, { message: 'El tamaño de página máximo es 100.' })
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Desde qué posición (con limit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La posición debe ser un número.' })
  @Min(0, { message: 'La posición no puede ser negativa.' })
  offset?: number;

  @ApiPropertyOptional({ description: 'Texto a buscar en título, descripción o lugar (con limit)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'La búsqueda admite hasta 100 caracteres.' })
  q?: string;

  @ApiPropertyOptional({ enum: ['interested', 'enrolled'], description: 'Solo las que me interesan o en las que estoy inscrito (estudiante, con limit)' })
  @IsOptional()
  @IsIn(['interested', 'enrolled'], { message: 'Filtro propio no válido.' })
  mine?: 'interested' | 'enrolled';
}
