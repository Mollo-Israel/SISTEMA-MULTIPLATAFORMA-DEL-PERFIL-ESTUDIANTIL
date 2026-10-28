import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

/** Módulos que admiten una excepción de Dirección (§9.2). */
export type ApprovalModule = 'RESOURCE' | 'GAMIFICATION' | 'ACTIVITY';

/**
 * Excepción de revisión concedida por Dirección a un docente (V5 §9.2).
 *
 * Sin fila vigente, el docente está en REQUIRE_REVIEW. La fila no se borra al
 * revocar: `revokedAt` cierra la excepción para lo que venga, y lo que ya se
 * publicó u otorgó con ella sigue apuntando aquí.
 */
@Entity('approval_policies')
export class ApprovalPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  module: ApprovalModule;

  @Column({ name: 'teacher_user_id', type: 'uuid' })
  teacherUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_user_id' })
  teacher: User;

  @Column({ type: 'varchar', length: 20, default: 'DIRECT_ALLOWED' })
  decision: 'DIRECT_ALLOWED';

  @Column({ type: 'varchar', length: 500 })
  justification: string;

  @Column({ name: 'granted_by', type: 'uuid' })
  grantedBy: string;

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'now()' })
  grantedAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy: string | null;

  @Column({ name: 'revoke_reason', type: 'varchar', length: 500, nullable: true })
  revokeReason: string | null;
}
