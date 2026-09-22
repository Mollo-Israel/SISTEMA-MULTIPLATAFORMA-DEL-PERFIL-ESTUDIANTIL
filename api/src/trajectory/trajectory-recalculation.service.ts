import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffinityEngineService } from '../affinity-recalc/affinity.engine';
import { Recommendation } from '../entities/recommendation.entity';
import { TrajectoryRecalculationPort, TrajectorySignal } from './trajectory-recalculation.port';

/**
 * Recomputacion centralizada de la trayectoria de un estudiante (§109).
 *
 * §109 pide «un mecanismo central que coordine afinidad, recomendaciones y
 * gamificacion cuando corresponda», y que reciba el `student_profile_id`
 * correcto. Esto es ese mecanismo.
 *
 * Hasta el BATCH 6 no hacia falta: el unico consumidor era la afinidad, y un
 * coordinador con un solo coordinado es un cascaron. Desde que las
 * recomendaciones consumen el respaldo de V2 (§58), ya son dos, y el orden
 * importa: recomendar con la afinidad vieja produciria consejos que contradicen
 * lo que el estudiante acaba de hacer.
 *
 * ## Por que las recomendaciones se invalidan y no se regeneran
 *
 * Regenerarlas aqui obligaria a recorrer el catalogo entero de actividades y
 * recursos en medio de la transaccion de quien subio un certificado. Se marcan
 * como no vigentes, que es barato, y la proxima consulta las vuelve a calcular
 * con datos frescos. Lo que el estudiante decidio -guardada, descartada- no se
 * toca: es suyo y sobrevive a cualquier recalculo (RN-16).
 */
@Injectable()
export class TrajectoryRecalculationService implements TrajectoryRecalculationPort {
  private readonly logger = new Logger(TrajectoryRecalculationService.name);

  constructor(
    private readonly affinity: AffinityEngineService,
    @InjectRepository(Recommendation)
    private readonly recommendations: Repository<Recommendation>,
  ) {}

  async requestRecalculation(
    studentProfileId: string,
    signal: TrajectorySignal = TrajectorySignal.PROFILE,
  ): Promise<void> {
    // 1. Afinidad. Si falla, falla todo: es la base sobre la que se apoya el
    //    resto y recomendar con ella a medias seria peor que no recomendar.
    await this.affinity.requestRecalculation(studentProfileId);

    // 2. Recomendaciones. Un fallo aqui no puede deshacer la afinidad ya
    //    calculada, que es correcta: se registra y se sigue.
    try {
      await this.recommendations.update(
        { studentProfileId, isCurrent: true },
        { isCurrent: false },
      );
    } catch (e) {
      this.logger.warn(
        `Afinidad de ${studentProfileId} recalculada por «${signal}», pero las `
        + `recomendaciones no pudieron invalidarse: ${String(e)}`,
      );
    }

    // 3. Gamificacion: §66, BATCH 9. El punto de enganche es este y no otro.
  }
}
