import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AFFINITY_ENGINE_VERSION } from '@perfil/shared';
import { AffinityResult } from '../entities/affinity-result.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AffinityEngineService } from './affinity.engine';

/** Perfiles por tanda. Nada que justifique cargar la base de golpe. */
const LOTE = 25;

/**
 * Migracion de los puntajes de afinidad al motor vigente (§131).
 *
 * La migracion de base de datos añade columnas, pero no puede recalcular: el
 * calculo vive en el motor, no en SQL. Y dejar los puntajes del V1 en su sitio
 * seria peor que no migrar nada, porque V1 guardaba puntos crudos sin techo y
 * V2 un porcentaje sobre 100: el mismo numero pasaria a significar otra cosa
 * sin que nadie lo notara.
 *
 * Por eso esto existe: al arrancar, recalcula los perfiles cuyo resultado
 * todavia lleva la version anterior. Es idempotente y se agota solo -una vez
 * recalculados, no encuentra nada que hacer-, y no toca las instantaneas
 * historicas, que conservan su version y su escala (§131: migrar sin destruir
 * historia).
 */
@Injectable()
export class AffinityBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AffinityBackfillService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly engine: AffinityEngineService,
    @InjectRepository(AffinityResult) private readonly results: Repository<AffinityResult>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('AFFINITY_BACKFILL_ON_BOOT') === 'false') {
      return;
    }
    // Sin `await`: el arranque de la API no depende de esto y bloquearlo
    // retrasaria el servicio para todos por una tarea que no es urgente.
    void this.run().catch((e) =>
      this.logger.error(`Recalculo masivo interrumpido: ${String(e)}`),
    );
  }

  /**
   * Recalcula los perfiles pendientes.
   *
   * `todos` fuerza el recalculo del padron completo, que es lo que hace falta
   * cuando cambian las ponderaciones: los puntajes de quien no volvio a entrar
   * al sistema quedarian calculados con la regla vieja.
   */
  async run(todos = false): Promise<{ recalculados: number; fallidos: number }> {
    const pendientes = await this.pendientes(todos);
    if (pendientes.length === 0) {
      return { recalculados: 0, fallidos: 0 };
    }

    this.logger.log(
      `Recalculando ${pendientes.length} perfil(es) con el motor v${AFFINITY_ENGINE_VERSION}.`,
    );

    let recalculados = 0;
    let fallidos = 0;
    for (let i = 0; i < pendientes.length; i += LOTE) {
      for (const id of pendientes.slice(i, i + LOTE)) {
        try {
          await this.engine.recalculate(id);
          recalculados++;
        } catch (e) {
          // Un perfil que falla no puede detener a los demas: quedaria media
          // poblacion con la escala vieja y la otra media con la nueva.
          fallidos++;
          this.logger.warn(`Perfil ${id} no pudo recalcularse: ${String(e)}`);
        }
      }
    }

    this.logger.log(`Recalculo terminado: ${recalculados} al dia, ${fallidos} con error.`);
    return { recalculados, fallidos };
  }

  /**
   * Perfiles a recalcular.
   *
   * Un perfil sin ninguna fila de resultado no entra: no tiene nada que
   * migrar, y su afinidad se calculara la primera vez que declare algo.
   */
  private async pendientes(todos: boolean): Promise<string[]> {
    if (todos) {
      const filas = await this.profiles.find({ select: { id: true } });
      return filas.map((p) => p.id);
    }

    const filas = await this.results
      .createQueryBuilder('result')
      .select('DISTINCT result.student_profile_id', 'id')
      .where('result.engine_version < :version', { version: AFFINITY_ENGINE_VERSION })
      .getRawMany<{ id: string }>();
    return filas.map((f) => f.id);
  }
}
