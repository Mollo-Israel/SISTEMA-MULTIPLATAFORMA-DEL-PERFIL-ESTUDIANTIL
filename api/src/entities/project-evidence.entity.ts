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

@Entity('project_evidences')
export class ProjectEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.evidences, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'evidence_type', type: 'enum', enum: EvidenceType })
  evidenceType: EvidenceType;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @Column({ name: 'external_url', type: 'varchar', length: 500, nullable: true })
  externalUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
