import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AiRunStatus, AiTaskType } from '@perfil/shared';
import { User } from './user.entity';

/**
 * Una ejecución del asistente de IA (V2 §43.3).
 *
 * Guarda lo que §43.3 exige —proveedor, modelo, tarea, huella de la entrada,
 * resultado, fecha y quién lo aceptó— y **no** guarda la entrada: la huella
 * permite reconocer que dos pedidos fueron iguales sin conservar el texto,
 * que puede incluir redacción personal del estudiante (§43.4).
 */
@Entity('ai_assistance_runs')
@Index(['requestedById', 'createdAt'])
export class AiAssistanceRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  provider: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ name: 'task_type', type: 'varchar', length: 40 })
  taskType: AiTaskType;

  /** SHA-256 de la entrada ya saneada. */
  @Column({ name: 'input_fingerprint', type: 'char', length: 64 })
  inputFingerprint: string;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20 })
  status: AiRunStatus;

  @Column({ name: 'error_message', type: 'varchar', length: 300, nullable: true })
  errorMessage: string | null;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs: number | null;

  /** Sobre qué se pidió: `project`, `skill`, `cv`, `team`... */
  @Column({ name: 'target_type', type: 'varchar', length: 40, nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User | null;

  @Column({ name: 'accepted_by', type: 'uuid', nullable: true })
  acceptedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accepted_by' })
  acceptedBy: User | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
