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
import { SkillInterestKind, SkillInterestSource } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { Skill } from './skill.entity';

/**
 * Interés del estudiante por una tecnología del catálogo (V2 §21, §22).
 *
 * Declarativo: sirve para recomendaciones, personalización y colaboración. El
 * motor de afinidad no lo lee (§45.1). Sustituye a `student_skills`, que se
 * conserva como histórico y ya no se escribe.
 */
@Entity('student_skill_interests')
@Unique('uq_student_skill_interest', ['studentProfileId', 'skillId'])
export class StudentSkillInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Index()
  @Column({ name: 'skill_id', type: 'uuid' })
  skillId: string;

  @ManyToOne(() => Skill, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @Column({
    type: 'enum',
    enum: SkillInterestKind,
    enumName: 'skill_interest_kind_enum',
    default: SkillInterestKind.INTEREST,
  })
  kind: SkillInterestKind;

  @Column({
    type: 'enum',
    enum: SkillInterestSource,
    enumName: 'skill_interest_source_enum',
    default: SkillInterestSource.DECLARED,
  })
  source: SkillInterestSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
