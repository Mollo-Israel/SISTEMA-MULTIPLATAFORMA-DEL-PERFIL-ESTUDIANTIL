import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { StoredFileRecord } from './stored-file.entity';

/** Quién registró la versión del modelo. */
export type ReferenceVersionOrigin =
  /** El responsable, mientras la oportunidad no estaba aprobada ni publicada. */
  | 'responsable'
  /** Dirección, con la acción «Adjuntar/actualizar certificado modelo» (D03). */
  | 'direccion'
  /** Modelo cargado antes del versionado (V7.1); se registra al primer uso. */
  | 'previo';

/**
 * V7.1 D03 · Una versión del certificado modelo de una oportunidad externa.
 *
 * El modelo es privado: solo sirve para comparar y nunca se entrega al
 * estudiante. Cada cambio deja una versión con su hash, autor, fecha y
 * motivo. Las comprobaciones guardan qué versión usaron, así que reemplazar
 * el modelo no borra la procedencia de lo ya comprobado.
 */
@Entity('validation_reference_versions')
export class ValidationReferenceVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column({ type: 'smallint' })
  version: number;

  /** `null` si la versión retira el modelo o si el archivo ya no existe. */
  @Column({ name: 'stored_file_id', type: 'uuid', nullable: true })
  storedFileId: string | null;

  @ManyToOne(() => StoredFileRecord, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stored_file_id' })
  storedFile: StoredFileRecord | null;

  @Column({ name: 'file_sha256', type: 'char', length: 64, nullable: true })
  fileSha256: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 160, nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', length: 20 })
  origin: ReferenceVersionOrigin;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
