import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Skill } from './skill.entity';
import { StudentInterest } from './student-interest.entity';
import { Project } from './project.entity';
import { Activity } from './activity.entity';
import { AffinityResult } from './affinity-result.entity';

@Entity('academic_areas')
export class AcademicArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @OneToMany(() => Skill, (skill) => skill.academicArea)
  skills: Skill[];

  @OneToMany(() => StudentInterest, (interest) => interest.academicArea)
  interests: StudentInterest[];

  @OneToMany(() => Project, (project) => project.academicArea)
  projects: Project[];

  @OneToMany(() => Activity, (activity) => activity.academicArea)
  activities: Activity[];

  @OneToMany(() => AffinityResult, (result) => result.academicArea)
  affinityResults: AffinityResult[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
