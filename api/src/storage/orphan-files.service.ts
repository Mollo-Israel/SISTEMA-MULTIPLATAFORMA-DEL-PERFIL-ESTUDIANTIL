import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { STORAGE_PORT, StoragePort } from './storage.port';

interface Huerfano {
  id: string;
  storage_key: string;
}

/**
 * Limpieza de archivos huérfanos (§136).
 *
 * Subir un archivo y adjuntarlo son dos pasos. Quien abandona el formulario
 * entre uno y otro deja el archivo escrito en disco y su fila en
 * `stored_files`, sin que nada lo vuelva a nombrar nunca. No es un fallo
 * visible —nadie ve un error—, pero acumula: cada intento descartado de subir
 * una constancia se queda ahí para siempre.
 *
 * Huérfano es el archivo que no menciona ningún certificado ni ninguna
 * evidencia, y que tampoco es el original del que otro archivo se declaró
 * duplicado (§28): borrar ese original dejaría a su duplicado apuntando a algo
 * que ya no existe, y con él la única razón por la que el sistema sabe que no
 * debe contarlos dos veces.
 *
 * El periodo de gracia es lo que separa «abandonado» de «todavía en curso».
 * Sin él, esto sería una carrera contra el usuario que está llenando el
 * formulario. Con veinticuatro horas por omisión no hay carrera posible: el
 * adjuntar ocurre segundos después de subir.
 *
 * Primero se borra el archivo y después su fila. Al revés, una caída entre
 * ambos pasos dejaría un archivo que nadie puede volver a encontrar para
 * borrarlo. En este orden, una caída deja una fila cuyo archivo ya no está, y
 * la vuelta siguiente la recoge y termina el trabajo.
 */
@Injectable()
export class OrphanFilesService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OrphanFilesService.name);

  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly graceHours: number;
  private readonly batchSize: number;

  private temporizador: NodeJS.Timeout | null = null;
  private detenido = false;

  constructor(
    @InjectRepository(StoredFileRecord)
    private readonly archivos: Repository<StoredFileRecord>,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('ORPHAN_CLEANUP_ENABLED', 'true') !== 'false';
    this.intervalMs = this.num(config, 'ORPHAN_CLEANUP_INTERVAL_MS', 6 * 60 * 60_000);
    this.graceHours = this.num(config, 'ORPHAN_CLEANUP_GRACE_HOURS', 24);
    this.batchSize = this.num(config, 'ORPHAN_CLEANUP_BATCH', 200);
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Limpieza de archivos huérfanos desactivada por configuración.');
      return;
    }
    this.logger.log(
      `Limpieza de archivos huérfanos activa (cada ${Math.round(this.intervalMs / 60_000)} min, `
      + `gracia de ${this.graceHours} h, hasta ${this.batchSize} por vuelta).`,
    );
    // La primera vuelta no es inmediata: al arrancar hay cosas más urgentes que
    // hacer, y nada de esto es urgente.
    this.agendar(60_000);
  }

  onApplicationShutdown(): void {
    this.detenido = true;
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  /**
   * Borra una tanda de huérfanos y devuelve cuántos quitó.
   *
   * Es público porque la suite de integración necesita provocar la limpieza
   * cuando le toca, en vez de esperar seis horas a que caiga la vuelta.
   */
  async limpiarTanda(): Promise<number> {
    const huerfanos: Huerfano[] = await this.archivos.query(
      `SELECT f.id, f.storage_key
         FROM stored_files f
        WHERE f.created_at < now() - ($1 || ' hours')::interval
          AND NOT EXISTS (
            SELECT 1 FROM external_certificates c WHERE c.stored_file_id = f.id)
          AND NOT EXISTS (
            SELECT 1 FROM project_evidences e WHERE e.stored_file_id = f.id)
          AND NOT EXISTS (
            SELECT 1 FROM stored_files d WHERE d.duplicate_of_id = f.id)
        ORDER BY f.created_at
        LIMIT $2`,
      [String(this.graceHours), this.batchSize],
    );

    let borrados = 0;
    for (const huerfano of huerfanos) {
      if (this.detenido) break;
      try {
        await this.storage.remove(huerfano.storage_key);
        await this.archivos.delete({ id: huerfano.id });
        borrados += 1;
      } catch (error) {
        // Un archivo que no se deja borrar no detiene a los demás: la vuelta
        // siguiente lo intentará otra vez.
        this.logger.warn(`No se pudo eliminar el huérfano ${huerfano.id}: ${String(error)}`);
      }
    }

    if (borrados > 0) {
      this.logger.log(`Archivos huérfanos eliminados: ${borrados}.`);
    }
    return borrados;
  }

  private agendar(ms: number): void {
    if (this.detenido) return;
    this.temporizador = setTimeout(() => {
      void this.vuelta();
    }, ms);
    // Que este temporizador no sea razón para mantener vivo el proceso.
    this.temporizador.unref?.();
  }

  private async vuelta(): Promise<void> {
    try {
      await this.limpiarTanda();
    } catch (error) {
      this.logger.error(`La limpieza de huérfanos falló esta vuelta: ${String(error)}`);
    } finally {
      // Encadenado y no `setInterval`: una vuelta lenta nunca solapa con la
      // siguiente.
      this.agendar(this.intervalMs);
    }
  }

  private num(config: ConfigService, key: string, porOmision: number): number {
    const valor = Number(config.get<string>(key));
    return Number.isFinite(valor) && valor > 0 ? valor : porOmision;
  }
}
