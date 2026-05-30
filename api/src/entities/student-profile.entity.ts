import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProfileStatus } from '@perfil/shared';
import { User } from './user.entity';
import { StudentSkill } from './student-skill.entity';
import { StudentInterest } from './student-interest.entity';
import { ActivityRegistration } from './activity-registration.entity';
import { ExternalCertificate } from './external-certificate.entity';
import { InternalConstancy } from './internal-constancy.entity';
import { AffinityResult } from './affinity-result.entity';

@Entity('student_profiles')
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.studentProfile, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ name: 'university_code', type: 'varchar', length: 30, nullable: true })
  universityCode: string | null;

  @Column({ type: 'smallint', nullable: true })
  semester: number | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'enum', enum: ProfileStatus, default: ProfileStatus.INCOMPLETE })
  status: ProfileStatus;

  @Column({ name: 'completion_percentage', type: 'smallint', default: 0 })
  completionPercentage: number;

  @Column({ name: 'improvement_area_ids', type: 'uuid', array: true, nullable: true })
  improvementAreaIds: string[] | null;

  @OneToMany(() => StudentSkill, (skill) => skill.studentProfile)
  skills: StudentSkill[];

  @OneToMany(() => StudentInterest, (interest) => interest.studentProfile)
  interests: StudentInterest[];

  @OneToMany(() => ActivityRegistration, (reg) => reg.studentProfile)
  registrations: ActivityRegistration[];

  @OneToMany(() => ExternalCertificate, (cert) => cert.studentProfile)
  externalCertificates: ExternalCertificate[];

  @OneToMany(() => InternalConstancy, (constancy) => constancy.studentProfile)
  internalConstancies: InternalConstancy[];

  @OneToMany(() => AffinityResult, (result) => result.studentProfile)
  affinityResults: AffinityResult[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
