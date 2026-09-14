import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RecommendationStatus } from '@perfil/shared';

export const HISTORY_STATUSES = [RecommendationStatus.SAVED, RecommendationStatus.DISMISSED];

/** Consulta de las recomendaciones que el estudiante guardo o descarto. */
export class QueryRecommendationHistoryDto {
  @ApiProperty({ enum: HISTORY_STATUSES, example: RecommendationStatus.DISMISSED })
  @IsIn(HISTORY_STATUSES, { message: 'Indique si quiere ver las guardadas o las descartadas.' })
  status: RecommendationStatus;
}
