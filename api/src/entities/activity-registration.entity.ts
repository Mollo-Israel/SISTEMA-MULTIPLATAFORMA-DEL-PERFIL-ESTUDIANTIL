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
import { RegistrationStatus } from '@perfil/shared';
import { Activity } from './activity.entity';
import { StudentProfile } from './student-profile.entity';
import { User } from './user.entity';

@Entity('activity_registrations')
@Unique('uq_activity_registration', ['activityId', 'studentProfileId'])
export class ActivityRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @ManyToOne(() => Activity, (activity) => activity.registrations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, (profile) => profile.registrations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ type: 'enum', enum: RegistrationStatus, default: RegistrationStatus.INTERESTED })
  status: RegistrationStatus;

  @Column({ name: 'confirmed_by', type: 'uuid', nullable: true })
  confirmedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
