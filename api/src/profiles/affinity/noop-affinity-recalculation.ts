import { Injectable, Logger } from '@nestjs/common';
import { AffinityRecalculationPort } from './affinity-recalculation.port';

@Injectable()
export class NoopAffinityRecalculation implements AffinityRecalculationPort {
  private readonly logger = new Logger('AffinityRecalculation');

  async requestRecalculation(studentProfileId: string): Promise<void> {
    this.logger.log(
      `Recalculo de afinidad pendiente para el perfil ${studentProfileId} (se implementa en Fase 6).`,
    );
  }
}
