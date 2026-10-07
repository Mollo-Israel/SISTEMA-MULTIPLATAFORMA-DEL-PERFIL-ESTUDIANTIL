import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProjectSkillEvidenceStatus } from '@perfil/shared';
import { Project } from './project.entity';
import { AcademicArea } from './academic-area.entity';
import { Skill } from './skill.entity';

/**
 * Áreas de un proyecto (V3 §21.2). Un proyecto puede tocar varias áreas;
 * `projects.academic_area_id` conserva la principal por compatibilidad.
 */
@Entity('project_areas')
export class ProjectArea {
  @PrimaryColumn({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @PrimaryColumn({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => Project, (p) => p.projectAreas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => AcademicArea, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;
}

/**
 * Tecnologías del catálogo que declara el proyecto (V3 §21.1, `skills[]`).
 *
 * Declarar no es respaldar: lo que cada integrante usó lo confirma él
 * (`project_member_skills`), y el respaldo técnico lo da el repositorio.
 */
@Entity('project_skills')
export class ProjectSkill {
  @PrimaryColumn({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @PrimaryColumn({ name: 'skill_id', type: 'uuid' })
  skillId: string;

  @ManyToOne(() => Project, (p) => p.projectSkills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  /** V3 §24.4: cómo se corroboró. Sin rastro, DECLARED (§29). */
  @Column({
    name: 'evidence_status', type: 'enum', enum: ProjectSkillEvidenceStatus,
    enumName: 'project_skill_evidence_enum', default: ProjectSkillEvidenceStatus.DECLARED,
  })
  evidenceStatus: ProjectSkillEvidenceStatus;

  /** De dónde: `languages`, `package.json (react)`… */
  @Column({ name: 'evidence_source', type: 'varchar', length: 200, nullable: true })
  evidenceSource: string | null;

  /** V3 §29: confirmación de un docente autorizado. */
  @Column({ name: 'academic_reviewed_by', type: 'uuid', nullable: true })
  academicReviewedById: string | null;

  @Column({ name: 'academic_reviewed_at', type: 'timestamptz', nullable: true })
  academicReviewedAt: Date | null;

  @Column({ name: 'academic_review_comment', type: 'varchar', length: 500, nullable: true })
  academicReviewComment: string | null;
}
