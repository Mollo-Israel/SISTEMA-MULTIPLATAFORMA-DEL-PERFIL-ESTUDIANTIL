import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectInvitationStatus } from '@perfil/shared';
import { Project } from './project.entity';
import { StudentProfile } from './student-profile.entity';
import { User } from './user.entity';

/**
 * Invitacion a integrar un proyecto del portafolio (RF14).
 *
 * El documento es explicito: el estudiante responsable invita, y el invitado
 * "puede aceptar o rechazar la invitacion ANTES de quedar asociado al proyecto"
 * (Tabla 2.23). Por eso la pertenencia no se inserta directamente: se crea esta
 * invitacion en estado PENDING y solo al aceptarla nace el ProjectMember.
 *
 * El unico por (proyecto, invitado) mientras esta PENDING se define en la
 * migracion como indice parcial: un mismo estudiante puede volver a ser
 * invitado despues de rechazar, pero no acumular invitaciones pendientes.
 */
@Entity('project_invitations')
export class ProjectInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.invitations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /** Perfil del estudiante invitado. Solo los estudiantes tienen perfil. */
  @Index()
  @Column({ name: 'invited_profile_id', type: 'uuid' })
  invitedProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_profile_id' })
  invitedProfile: StudentProfile;

  /** Rol propuesto dentro del proyecto: texto acotado, no un enum cerrado. */
  @Column({ name: 'proposed_role', type: 'varchar', length: 80 })
  proposedRole: string;

  @Index()
  @Column({ type: 'enum', enum: ProjectInvitationStatus, default: ProjectInvitationStatus.PENDING })
  status: ProjectInvitationStatus;

  /** Quien envio la invitacion; siempre el estudiante responsable del proyecto. */
  @Column({ name: 'invited_by', type: 'uuid', nullable: true })
  invitedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invited_by' })
  invitedBy: User | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
