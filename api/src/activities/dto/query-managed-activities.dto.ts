import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { FindOptionsWhere, IsNull } from 'typeorm';
import { ActivityOrigin, ActivityReviewStatus, ActivityStatus, ActivityType } from '@perfil/shared';
import type { Activity } from '../../entities/activity.entity';

/**
 * V7.1 §4.1: el estado de revisión tiene su propio filtro. «unsubmitted» es
 * el borrador que todavía no se envió (en la base, `review_status` nulo).
 */
export const REVISIONES_DE_GESTION = ['unsubmitted', ...Object.values(ActivityReviewStatus)] as const;
export type RevisionDeGestion = (typeof REVISIONES_DE_GESTION)[number];

/**
 * Filtros de «Actividades que gestiona». El ciclo de vida (`status`) y la
 * revisión (`review`) son dos ejes independientes y nunca se mezclan en un
 * mismo selector. Sin filtros, la respuesta es la de siempre.
 */
export class QueryManagedActivitiesDto {
  @ApiPropertyOptional({ enum: ActivityType, description: 'Académica o extracurricular' })
  @IsOptional()
  @IsEnum(ActivityType, { message: 'El tipo de actividad no es válido.' })
  type?: ActivityType;

  @ApiPropertyOptional({ enum: ActivityOrigin, description: 'Interna o externa' })
  @IsOptional()
  @IsEnum(ActivityOrigin, { message: 'El origen debe ser interno o externo.' })
  originType?: ActivityOrigin;

  @ApiPropertyOptional({ enum: ActivityStatus, description: 'Estado de la actividad (ciclo de vida)' })
  @IsOptional()
  @IsEnum(ActivityStatus, { message: 'El estado de actividad no es válido.' })
  status?: ActivityStatus;

  @ApiPropertyOptional({ enum: REVISIONES_DE_GESTION, description: 'Estado de revisión de Dirección' })
  @IsOptional()
  @IsIn(REVISIONES_DE_GESTION, { message: 'El estado de revisión no es válido.' })
  review?: RevisionDeGestion;
}

/**
 * Condiciones SQL de los filtros. Es lo mismo que la web muestra en la
 * columna «Revisión»: sin revisión requerida se lee «No requiere revisión»
 * aunque la fila tenga un estado guardado.
 */
export function condicionesDeGestion(f: QueryManagedActivitiesDto): FindOptionsWhere<Activity>[] {
  const base: FindOptionsWhere<Activity> = {};
  if (f.type) base.type = f.type;
  if (f.originType) base.originType = f.originType;
  if (f.status) base.status = f.status;
  if (!f.review) return [base];
  if (f.review === ActivityReviewStatus.NOT_REQUIRED) {
    return [{ ...base, requiresReview: false }, { ...base, reviewStatus: ActivityReviewStatus.NOT_REQUIRED }];
  }
  if (f.review === 'unsubmitted') return [{ ...base, requiresReview: true, reviewStatus: IsNull() }];
  return [{ ...base, requiresReview: true, reviewStatus: f.review }];
}
