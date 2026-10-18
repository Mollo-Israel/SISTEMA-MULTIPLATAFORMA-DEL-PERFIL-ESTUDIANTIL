import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * «Tecnología no catalogada» que un estudiante pide evaluar (V4.1 A41-020, §11.2, §11.4).
 *
 * Nada se agrega al catálogo por una dependencia detectada: Administración
 * decide si la tecnología existe (con su área y alias) o la rechaza. Mientras
 * tanto no puntúa ni bloquea un borrador.
 */
@Entity('skill_requests')
export class SkillRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Dónde se detectó («requirements.txt (fastapi)»), si vino de una sugerencia. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  source: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: 'pending' | 'added' | 'rejected';

  @Column({ name: 'skill_id', type: 'uuid', nullable: true })
  skillId: string | null;

  @Column({ name: 'decision_note', type: 'varchar', length: 300, nullable: true })
  decisionNote: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
