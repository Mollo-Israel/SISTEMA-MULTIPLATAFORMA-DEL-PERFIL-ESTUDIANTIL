import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SkillLevel } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { Skill } from './skill.entity';

@Entity('student_skills')
@Unique('uq_student_skill', ['studentProfileId', 'skillId'])
export class StudentSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, (profile) => profile.skills, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Index()
  @Column({ name: 'skill_id', type: 'uuid' })
  skillId: string;

  @ManyToOne(() => Skill, (skill) => skill.studentSkills, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  /**
   * Autoevaluacion en tres niveles (§21.1).
   *
   * Era una escala numerica de 1 a 5. Pedir esa precision a una
   * autoevaluacion sugiere una exactitud que no tiene: nadie sabe si esta
   * en un 3 o en un 4 de si mismo.
   *
   * Sea cual sea el valor, esto es **autodeclarado**. La experiencia
   * respaldada por proyectos, actividades o certificados se cuenta aparte
   * (§21.2) y nunca se mezcla con esto.
   */
  @Column({ type: 'enum', enum: SkillLevel, default: SkillLevel.BASIC })
  level: SkillLevel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
