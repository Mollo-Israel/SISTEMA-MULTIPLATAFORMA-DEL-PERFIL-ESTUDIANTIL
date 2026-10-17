import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, Column } from 'typeorm';
import { Activity } from './activity.entity';
import { StoredFileRecord } from './stored-file.entity';

/**
 * Imágenes de una actividad (V4.1 A41-006, A.5).
 *
 * Hasta cinco, en orden: la de `position` 0 es la portada y se copia también
 * en `activities.image_file_id`, para que los clientes que solo conocen una
 * imagen (la app móvil, versiones anteriores de la web) sigan viendo la misma.
 */
@Entity('activity_images')
export class ActivityImage {
  @PrimaryColumn({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @PrimaryColumn({ name: 'stored_file_id', type: 'uuid' })
  storedFileId: string;

  @Column({ type: 'smallint', default: 0 })
  position: number;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @ManyToOne(() => StoredFileRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stored_file_id' })
  storedFile: StoredFileRecord;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
