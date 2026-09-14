import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RecommendationStatus } from '@perfil/shared';

/** Estados que el estudiante puede fijar sobre una recomendacion (RN-16). */
export const DECIDABLE_STATUSES = [
  RecommendationStatus.VIEWED,
  RecommendationStatus.SAVED,
  RecommendationStatus.DISMISSED,
];

/**
 * Decision del estudiante sobre una recomendacion (RN-16).
 *
 *  - saved:     la guarda para tenerla en cuenta.
 *  - dismissed: no le interesa; no vuelve a proponerse.
 *  - viewed:    deshace una decision anterior y la devuelve a la lista.
 *
 * "new" no se admite: una recomendacion solo es nueva mientras nadie la abrio.
 */
export class UpdateRecommendationDto {
  @ApiProperty({ enum: DECIDABLE_STATUSES, example: RecommendationStatus.SAVED })
  @IsIn(DECIDABLE_STATUSES, {
    message: 'Solo puede marcar la recomendación como vista, guardada o descartada.',
  })
  status: RecommendationStatus;
}
