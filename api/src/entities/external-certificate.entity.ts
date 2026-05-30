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

@Entity('external_certificates')
export class ExternalCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, (profile) => profile.externalCertificates, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 160 })
  issuer: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string | null;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
