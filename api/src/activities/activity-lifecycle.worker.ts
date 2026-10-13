import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivitiesService } from './activities.service';

/**
 * V3.2 §21.4–§21.5 · Ciclo de vida automático de las actividades.
 *
 * Cada vuelta cierra las inscripciones de lo que ya empezó (CLOSED) y da por
 * finalizado lo que ya terminó (FINISHED). Se agenda con `setTimeout`
 * encadenado, igual que los otros trabajadores: una vuelta lenta nunca se
 * solapa con la siguiente.
 *
 * `ACTIVITY_LIFECYCLE_INTERVAL_MS` (60000 por omisión; 0 lo apaga).
 */
@Injectable()
export class ActivityLifecycleWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('CicloDeActividades');
  private temporizador: NodeJS.Timeout | null = null;
  private detenido = false;
  private readonly intervalo: number;

  constructor(
    private readonly activities: ActivitiesService,
    config: ConfigService,
  ) {
    const valor = Number(config.get<string>('ACTIVITY_LIFECYCLE_INTERVAL_MS') ?? 60000);
    this.intervalo = Number.isFinite(valor) && valor >= 0 ? valor : 60000;
  }

  onApplicationBootstrap(): void {
    if (this.intervalo === 0) {
      this.logger.log('Ciclo automático de actividades desactivado (ACTIVITY_LIFECYCLE_INTERVAL_MS=0).');
      return;
    }
    this.logger.log(`Ciclo automático de actividades activo (cada ${this.intervalo} ms).`);
    this.agendar(1000);
  }

  onApplicationShutdown(): void {
    this.detenido = true;
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  private agendar(ms: number): void {
    if (this.detenido) return;
    this.temporizador = setTimeout(() => void this.vuelta(), ms);
    this.temporizador.unref?.();
  }

  private async vuelta(): Promise<void> {
    try {
      const r = await this.activities.avanzarCicloDeVida();
      if (r.cerradas || r.finalizadas) {
        this.logger.log(`Cerradas por inicio: ${r.cerradas}; finalizadas por fin: ${r.finalizadas}.`);
      }
    } catch (e) {
      this.logger.warn(`La vuelta del ciclo de actividades falló: ${(e as Error).message}`);
    } finally {
      this.agendar(this.intervalo);
    }
  }
}
