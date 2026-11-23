import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type LedgerEvent =
  | 'KEY_REGISTERED'
  | 'POLICY_CHANGED'
  | 'ISSUED'
  | 'SUSPENDED'
  | 'SUSPENSION_LIFTED'
  | 'REVOKED';

/**
 * Bitácora de transparencia de las credenciales (V8).
 *
 * Cada entrada guarda el hash de la anterior: `entry_hash` =
 * SHA-256(`prev_hash` | `seq` | evento | JCS(datos)). Cambiar o borrar una
 * entrada rompe la cadena desde ahí hasta el final, y cualquiera que haya
 * anotado la cabeza publicada lo nota.
 *
 * La base no deja modificarla: un trigger rechaza UPDATE, DELETE y TRUNCATE.
 * Los datos no llevan nombres ni correos, solo códigos, huellas y motivos
 * resumidos por hash.
 */
@Entity('credential_ledger')
export class CredentialLedgerEntry {
  @PrimaryColumn({ type: 'bigint' })
  seq: string;

  @Column({ type: 'varchar', length: 30 })
  event: LedgerEvent;

  @Column({ name: 'public_code', type: 'varchar', length: 20, nullable: true })
  publicCode: string | null;

  @Column({ type: 'jsonb' })
  data: Record<string, unknown>;

  @Column({ name: 'prev_hash', type: 'char', length: 64 })
  prevHash: string;

  @Column({ name: 'entry_hash', type: 'char', length: 64 })
  entryHash: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
