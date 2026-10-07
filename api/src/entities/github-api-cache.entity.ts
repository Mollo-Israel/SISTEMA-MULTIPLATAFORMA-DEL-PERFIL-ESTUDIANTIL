import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Caché de respuestas de la API de GitHub (V3 §24.6).
 *
 * Una fila por URL consultada, con su ETag: volver a preguntar con
 * `If-None-Match` devuelve 304 si nada cambió, y GitHub no lo descuenta de
 * la cuota. Así un recálculo o una edición del título no gastan cuota.
 */
@Entity('github_api_cache')
export class GithubApiCache {
  @PrimaryColumn({ type: 'varchar', length: 600 })
  url: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  etag: string | null;

  /** Estado HTTP de la última respuesta útil (200 o 404). */
  @Column({ type: 'smallint' })
  status: number;

  /** Cuerpo JSON tal cual, o null en un 404. */
  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;
}
