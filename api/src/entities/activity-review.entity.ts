import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GamificationTrigger, type ActivityReviewAction } from '@perfil/shared';
import { Activity } from './activity.entity';
import { User } from './user.entity';
import { GamificationCriterion } from './gamification-criterion.entity';

/**
 * Una decisión en la revisión de una actividad (V2 §27): envío, aprobación,
 * observación o rechazo. Es la auditoría de la aprobación (§88, punto 12).
 */
@Entity('activity_reviews')
@Index(['activityId', 'createdAt'])
export class ActivityReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User | null;

  @Column({ type: 'varchar', length: 20 })
  action: ActivityReviewAction;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/**
 * Regla de gamificación propia de una actividad (V2 §31.2): cuántos puntos da
 * un hecho permitido en ESTA actividad. Sin expresiones ni scripts: un hecho
 * de la lista controlada, unos puntos en rango y, opcionalmente, una insignia.
 */
@Entity('activity_gamification_rules')
export class ActivityGamificationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  /** Criterio del catálogo global del que parte la regla. */
  @Column({ name: 'criterion_id', type: 'uuid', nullable: true })
  criterionId: string | null;

  @ManyToOne(() => GamificationCriterion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'criterion_id' })
  criterion: GamificationCriterion | null;

  @Column({ type: 'enum', enum: GamificationTrigger, enumName: 'gamification_criteria_trigger_enum' })
  trigger: GamificationTrigger;

  @Column({ type: 'int' })
  points: number;

  @Column({ name: 'badge_id', type: 'uuid', nullable: true })
  badgeId: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
