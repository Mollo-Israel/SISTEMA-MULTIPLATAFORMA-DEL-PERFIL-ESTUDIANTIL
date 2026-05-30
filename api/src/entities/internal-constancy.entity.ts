import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { User } from './user.entity';

@Entity('internal_constancies')
export class InternalConstancy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, (profile) => profile.internalConstancies, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  type: string | null;

  @Index()
  @Column({ name: 'issued_by', type: 'uuid' })
  issuedById: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'issued_by' })
  issuedBy: User;

  @Column({ type: 'boolean', default: true })
  authorized: boolean;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
