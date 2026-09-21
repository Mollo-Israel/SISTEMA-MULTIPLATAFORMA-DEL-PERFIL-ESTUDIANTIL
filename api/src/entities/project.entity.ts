import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectStatus, ProjectVisibility } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { AcademicArea } from './academic-area.entity';
import { ProjectMember } from './project-member.entity';
import { ProjectEvidence } from './project-evidence.entity';
import { ProjectInvitation } from './project-invitation.entity';
import { ProjectFeedback } from './project-feedback.entity';
import { ProjectBackingTier } from '@perfil/shared';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.DRAFT })
  status: ProjectStatus;

  /**
   * Nivel de visibilidad del proyecto (RF13).
   * Determina quien puede verlo mas alla del responsable y sus integrantes.
   */
  @Index()
  @Column({ type: 'enum', enum: ProjectVisibility, default: ProjectVisibility.PROFILE })
  visibility: ProjectVisibility;

  @Column({ type: 'text', array: true, nullable: true })
  technologies: string[] | null;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid', nullable: true })
  academicAreaId: string | null;

  @ManyToOne(() => AcademicArea, (area) => area.projects, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea | null;

  @Index()
  @Column({ name: 'created_by_profile_id', type: 'uuid' })
  createdByProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_profile_id' })
  createdByProfile: StudentProfile;

  @Column({ name: 'repository_url', type: 'varchar', length: 500, nullable: true })
  repositoryUrl: string | null;

  @Column({ name: 'demo_url', type: 'varchar', length: 500, nullable: true })
  demoUrl: string | null;

  /**
   * Nivel de respaldo derivado (§36).
   *
   * No se fija a mano: lo recalcula el sistema a partir de senales
   * observables —integrantes aceptados, evidencias, repositorio, demo,
   * retroalimentacion—. Crear un proyecto por si solo deja DECLARED (§32).
   */
  @Index()
  @Column({
    name: 'backing_tier',
    type: 'enum',
    enum: ProjectBackingTier,
    default: ProjectBackingTier.DECLARED,
  })
  backingTier: ProjectBackingTier;

  /** Por que esta en ese nivel, en lenguaje legible. */
  @Column({ name: 'backing_reasons', type: 'text', array: true, nullable: true })
  backingReasons: string[] | null;

  @OneToMany(() => ProjectMember, (member) => member.project)
  members: ProjectMember[];

  @OneToMany(() => ProjectEvidence, (evidence) => evidence.project)
  evidences: ProjectEvidence[];

  @OneToMany(() => ProjectInvitation, (invitation) => invitation.project)
  invitations: ProjectInvitation[];

  @OneToMany(() => ProjectFeedback, (feedback) => feedback.project)
  feedback: ProjectFeedback[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
