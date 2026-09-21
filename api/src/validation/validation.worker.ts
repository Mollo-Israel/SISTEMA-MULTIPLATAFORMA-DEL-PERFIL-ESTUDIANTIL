import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValidationService } from './validation.service';

/**
 * Worker de validación dentro del monolito (especificacion §76).
 *
 * §76 permite resolverlo con base de datos y un temporizador en lugar de
 * introducir Redis, y eso se hace: la cola es una tabla y esto es un bucle que
 * la mira cada pocos segundos. Menos piezas que mantener y una menos que
 * levantar para que el sistema funcione.
 *
 * Lo que exige §76 y aquí se cumple:
 *
 *   - **reclamar de forma segura**: el reclamo es un UPDATE condicional, así
 *     que dos procesos no pueden llevarse el mismo trabajo;
 *   - **no procesar dos veces**: consecuencia de lo anterior;
 *   - **registrar intentos**: cada reclamo incrementa el contador;
 *   - **retroceso acotado**: el reintento se aleja, pero con tope;
 *   - **no perder trabajos al reiniciar**: al arrancar se devuelven a la cola
 *     los que quedaron reclamados por un proceso que ya no existe.
 *
 * El bucle se agenda con `setTimeout` encadenado y no con `setInterval`: así
 * una vuelta lenta nunca solapa con la siguiente.
 */
@Injectable()
export class ValidationWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ValidationWorker.name);

  /** Identifica a este proceso en la columna `claimed_by`. */
  private readonly workerId = `${process.pid}-${randomUUID().slice(0, 8)}`;

  private readonly enabled: boolean;
  private readonly pollMs: number;
  private readonly batchSize: number;
  private readonly staleMs: number;

  private temporizador: NodeJS.Timeout | null = null;
  private detenido = false;
  private trabajando = false;

  constructor(
    private readonly validation: ValidationService,
    config: ConfigService,
  ) {
    // Apagable: las suites de integración lo desactivan para disparar el
    // procesamiento a mano y no depender de cuándo toque la siguiente vuelta.
    this.enabled = config.get<string>('VALIDATION_WORKER_ENABLED', 'true') !== 'false';
    this.pollMs = this.num(config, 'VALIDATION_WORKER_POLL_MS', 5_000);
    this.batchSize = this.num(config, 'VALIDATION_WORKER_BATCH', 3);
    this.staleMs = this.num(config, 'VALIDATION_WORKER_STALE_MS', 5 * 60_000);
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Worker de validación desactivado por configuración.');
      return;
    }

    // Antes de nada, rescatar lo que se quedó a medias en el arranque
    // anterior. Sin esto, un reinicio en mal momento deja trabajos congelados
    // en PROCESSING para siempre.
    await this.validation.recoverStale(this.staleMs).catch((error) => {
      this.logger.error(`No se pudo recuperar la cola al arrancar: ${String(error)}`);
      return 0;
    });

    this.logger.log(
      `Worker de validación activo (id ${this.workerId}, cada ${this.pollMs} ms, `
      + `hasta ${this.batchSize} por vuelta).`,
    );
    this.agendar(0);
  }

  onApplicationShutdown(): void {
    this.detenido = true;
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  /**
   * Procesa hasta `limite` trabajos y devuelve cuántos hizo.
   *
   * Es público porque las pruebas necesitan disparar una vuelta y esperar su
   * resultado, en lugar de dormir confiando en que el temporizador haya
   * pasado.
   */
  async runOnce(limite = this.batchSize): Promise<number> {
    let hechos = 0;
    for (let i = 0; i < limite; i += 1) {
      const trabajo = await this.validation.claimNext(this.workerId);
      if (!trabajo) break;
      await this.validation.process(trabajo);
      hechos += 1;
    }
    return hechos;
  }

  private agendar(retraso: number): void {
    if (this.detenido) return;
    this.temporizador = setTimeout(() => void this.vuelta(), retraso);
    // No debe mantener vivo el proceso: sin esto, cerrar la API se quedaría
    // esperando al siguiente tic.
    this.temporizador.unref?.();
  }

  private async vuelta(): Promise<void> {
    if (this.detenido || this.trabajando) return;
    this.trabajando = true;
    try {
      const hechos = await this.runOnce();
      // Si hubo trabajo, se vuelve enseguida: es probable que haya más en
      // cola y no tiene sentido esperar el intervalo completo.
      this.agendar(hechos > 0 ? 250 : this.pollMs);
    } catch (error) {
      this.logger.error(`Vuelta del worker fallida: ${String(error)}`);
      this.agendar(this.pollMs);
    } finally {
      this.trabajando = false;
    }
  }

  private num(config: ConfigService, clave: string, porDefecto: number): number {
    const valor = Number(config.get<string>(clave));
    return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
  }
}
