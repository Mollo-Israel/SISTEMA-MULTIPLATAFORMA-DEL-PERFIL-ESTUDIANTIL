import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProjectMember } from './project-member.entity';
import { Skill } from './skill.entity';

/**
 * Tecnologia que un integrante concreto uso en el proyecto
 * (especificacion §34, §73.4).
 *
 * Es distinta de `project.technologies`, que describe el proyecto entero. El
 * ejemplo de §34 lo dice todo:
 *
 *   Proyecto:     React, NestJS, PostgreSQL, Docker
 *   Integrante A: React
 *   Integrante B: NestJS, PostgreSQL
 *
 * Sin esta distincion, entrar en un proyecto de cuatro tecnologias atribuia
 * las cuatro a cada integrante. La afinidad individual usa principalmente
 * estas, no las del proyecto.
 */
@Entity('project_member_skills')
@Unique('uq_project_member_skill', ['projectMemberId', 'skillId'])
export class ProjectMemberSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_member_id', type: 'uuid' })
  projectMemberId: string;

  @ManyToOne(() => ProjectMember, (member) => member.memberSkills, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_member_id' })
  projectMember: ProjectMember;

  @Index()
  @Column({ name: 'skill_id', type: 'uuid' })
  skillId: string;

  @ManyToOne(() => Skill, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
