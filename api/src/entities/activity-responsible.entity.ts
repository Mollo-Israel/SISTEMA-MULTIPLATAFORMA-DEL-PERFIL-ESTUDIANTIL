import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { User } from './user.entity';

/**
 * Responsable académico u operativo de una actividad (V3.2 §16).
 *
 * Una actividad tiene uno o varios. Gestionan la actividad y confirman la
 * participación. No es lo mismo que su creador (`creator_id`) ni que un
 * contacto visible para el estudiante.
 */
@Entity('activity_responsibles')
export class ActivityResponsible {
  @PrimaryColumn({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
