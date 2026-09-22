import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recommendation } from '../entities/recommendation.entity';
import { AffinityRecalcModule } from '../affinity-recalc/affinity-recalc.module';
import { GamificationModule } from '../gamification/gamification.module';
import { TRAJECTORY_RECALCULATION } from './trajectory-recalculation.port';
import { TrajectoryRecalculationService } from './trajectory-recalculation.service';

/**
 * Recomputacion centralizada (§109).
 *
 * Es el modulo que los demas importan cuando algo del estudiante cambia. No
 * expone el motor de afinidad: quien avisa de un cambio no deberia poder
 * elegir que se recalcula y que no, porque entonces el coordinador seria
 * opcional y a la larga alguien lo saltaria.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Recommendation]),
    AffinityRecalcModule,
    GamificationModule,
  ],
  providers: [
    TrajectoryRecalculationService,
    { provide: TRAJECTORY_RECALCULATION, useExisting: TrajectoryRecalculationService },
  ],
  exports: [TRAJECTORY_RECALCULATION],
})
export class TrajectoryModule {}
