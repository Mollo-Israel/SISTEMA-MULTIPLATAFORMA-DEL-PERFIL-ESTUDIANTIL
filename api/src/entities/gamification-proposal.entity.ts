import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GamificationCriterion } from './gamification-criterion.entity';

/**
 * Propuesta de puntos de un docente (V4.1 A41-016, §9.3, A.10).
 *
 * El docente no otorga puntos: propone un criterio configurado sobre un hecho
 * concreto (hoy, un proyecto de un estudiante de su alcance) y Dirección
 * aprueba o rechaza. Al aprobarse, los puntos entran una sola vez al
 * historial, con la clave (estudiante, criterio, origen).
 */
@Entity('gamification_proposals')
export class GamificationProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'criterion_id', type: 'uuid' })
  criterionId: string;

  @ManyToOne(() => GamificationCriterion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'criterion_id' })
  criterion: GamificationCriterion;

  @Column({ name: 'source_type', type: 'varchar', length: 20 })
  sourceType: 'project';

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @Column({ name: 'proposed_by', type: 'uuid' })
  proposedBy: string;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'review_comment', type: 'varchar', length: 500, nullable: true })
  reviewComment: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
