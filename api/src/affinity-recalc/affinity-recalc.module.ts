import { Module } from '@nestjs/common';
import { AFFINITY_RECALCULATION } from './affinity-recalculation.port';
import { NoopAffinityRecalculation } from './noop-affinity-recalculation';

@Module({
  providers: [{ provide: AFFINITY_RECALCULATION, useClass: NoopAffinityRecalculation }],
  exports: [AFFINITY_RECALCULATION],
})
export class AffinityRecalcModule {}
