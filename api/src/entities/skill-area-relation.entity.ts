import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AcademicArea } from './academic-area.entity';
import { Skill } from './skill.entity';

/**
 * V3.2 §11: área secundaria de una habilidad.
 *
 * La principal sigue en `skills.academic_area_id`. Una secundaria permite
 * ofrecer la habilidad en los formularios de otra área («Relacionadas con esta
 * área»), pero no reparte puntaje: la afinidad usa el área explícita de cada
 * experiencia (§11.5).
 */
@Entity('skill_area_relations')
export class SkillAreaRelation {
  @PrimaryColumn({ name: 'skill_id', type: 'uuid' })
  skillId: string;

  @PrimaryColumn({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @Column({ name: 'relation_type', type: 'varchar', length: 20, default: 'SECONDARY' })
  relationType: 'SECONDARY';

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @ManyToOne(() => AcademicArea, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
