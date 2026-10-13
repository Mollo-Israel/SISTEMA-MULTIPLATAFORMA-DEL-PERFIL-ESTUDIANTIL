import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Activity } from './activity.entity';
import { User } from './user.entity';

/**
 * Persona de contacto de una actividad (V3.2 §16).
 *
 * A quien el estudiante puede escribir. Puede ser un estudiante de contexto si
 * un docente lo asigna: ese estudiante no publica, no aprueba, no confirma
 * asistencia y no adquiere ningún rol nuevo.
 */
@Entity('activity_contacts')
export class ActivityContact {
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
