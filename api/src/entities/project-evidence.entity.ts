import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EvidenceType } from '@perfil/shared';
import { Project } from './project.entity';
import { StudentProfile } from './student-profile.entity';
import { Activity } from './activity.entity';
import { AcademicArea } from './academic-area.entity';

/**
 * Evidencia academica del estudiante (RF11).
 *
 * Siempre pertenece a un perfil, y opcionalmente se asocia a un proyecto, a una
 * actividad o a un area academica, segun lo que la evidencia respalde. Conserva
 * el nombre de tabla project_evidences para no romper el historial existente.
 */
@Entity('project_evidences')
export class ProjectEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Index()
  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, (project) => project.evidences, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Index()
  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity | null;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid', nullable: true })
  academicAreaId: string | null;

  @ManyToOne(() => AcademicArea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea | null;

  @Column({ name: 'evidence_type', type: 'enum', enum: EvidenceType })
  evidenceType: EvidenceType;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @Column({ name: 'external_url', type: 'varchar', length: 500, nullable: true })
  externalUrl: string | null;

  /** Metadatos del archivo subido; nulos cuando la evidencia es un enlace. */
  @Column({ name: 'file_name', type: 'varchar', length: 160, nullable: true })
  fileName: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType: string | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
