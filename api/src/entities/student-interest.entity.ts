import {
  Check,
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
import { StudentProfile } from './student-profile.entity';
import { AcademicArea } from './academic-area.entity';

@Entity('student_interests')
@Unique('uq_student_interest', ['studentProfileId', 'academicAreaId'])
@Check('chk_student_interest_priority', 'priority >= 1 AND priority <= 5')
export class StudentInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, (profile) => profile.interests, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => AcademicArea, (area) => area.interests, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;

  @Column({ type: 'smallint', default: 1 })
  priority: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
