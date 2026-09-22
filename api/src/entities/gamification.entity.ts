import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { BadgeCode, GamificationTrigger } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';

/**
 * Un hecho reconocido con puntos (§66, §73.8).
 *
 * `dedupe_key` es lo que hace el sistema idempotente, que §66 exige
 * expresamente. Sin ella, confirmar dos veces una participación —o un recálculo
 * que vuelve a pasar por el mismo proyecto— daría puntos otra vez, y los puntos
 * dejarían de significar «hiciste esto» para significar «esto se procesó varias
 * veces».
 *
 * La clave es del hecho, no del momento: `participacion:<id de la inscripción>`
 * vale para siempre y no depende de cuándo se registre.
 */
@Entity('gamification_events')
@Unique('uq_gamification_event', ['studentProfileId', 'dedupeKey'])
@Index('idx_gamification_events_perfil', ['studentProfileId', 'occurredAt'])
export class GamificationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({
    type: 'enum',
    enum: GamificationTrigger,
    enumName: 'gamification_criteria_trigger_enum',
  })
  trigger: GamificationTrigger;

  /** Identidad del hecho. Dos veces el mismo hecho es un solo evento. */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 120 })
  dedupeKey: string;

  @Column({ type: 'int' })
  points: number;

  /** Texto legible: el estudiante ve por qué obtuvo cada punto. */
  @Column({ type: 'varchar', length: 300 })
  reason: string;

  /**
   * Registro que originó el hecho. Sin clave foránea a propósito: apunta a
   * tablas distintas según el disparador, y el historial debe sobrevivir
   * aunque ese registro se elimine.
   */
  @Column({ name: 'source_entity_type', type: 'varchar', length: 40, nullable: true })
  sourceEntityType: string | null;

  @Column({ name: 'source_entity_id', type: 'uuid', nullable: true })
  sourceEntityId: string | null;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}

/**
 * Total acumulado de un estudiante (§73.8, `student_points`).
 *
 * Es una caché: se recalcula sumando los eventos, nunca incrementando. Un
 * contador que se incrementa acaba desviándose de lo que explica —basta un
 * evento borrado o una transacción a medias— y entonces el número que ve el
 * estudiante deja de corresponder a su propia lista.
 */
@Entity('student_points')
export class StudentPoints {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ name: 'total_points', type: 'int', default: 0 })
  totalPoints: number;

  @Column({ name: 'events_count', type: 'int', default: 0 })
  eventsCount: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Insignia del catálogo (§73.8).
 *
 * Cada una reconoce una cantidad de un hecho concreto —`trigger` más
 * `threshold`— y no el puntaje total. Una insignia por acumular puntos
 * premiaría acumular; §66 quiere reconocer cosas hechas.
 */
@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'enum', enum: BadgeCode, enumName: 'badge_code_enum' })
  code: BadgeCode;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 300 })
  description: string;

  /** Qué hecho cuenta para esta insignia. */
  @Column({
    type: 'enum',
    enum: GamificationTrigger,
    enumName: 'gamification_criteria_trigger_enum',
  })
  trigger: GamificationTrigger;

  /** Cuántas veces hace falta. El progreso se mide contra esto. */
  @Column({ type: 'smallint', default: 1 })
  threshold: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** Insignia obtenida por un estudiante (§73.8). */
@Entity('student_badges')
@Unique('uq_student_badge', ['studentProfileId', 'badgeId'])
export class StudentBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Index()
  @Column({ name: 'badge_id', type: 'uuid' })
  badgeId: string;

  @ManyToOne(() => Badge, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'badge_id' })
  badge: Badge;

  @CreateDateColumn({ name: 'awarded_at' })
  awardedAt: Date;
}
