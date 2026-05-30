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
import { AffinityLevel } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { AcademicArea } from './academic-area.entity';

@Entity('affinity_results')
@Unique('uq_affinity_result', ['studentProfileId', 'academicAreaId'])
export class AffinityResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, (profile) => profile.affinityResults, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => AcademicArea, (area) => area.affinityResults, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'enum', enum: AffinityLevel, default: AffinityLevel.LOW })
  level: AffinityLevel;

  @CreateDateColumn({ name: 'calculated_at' })
  calculatedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
