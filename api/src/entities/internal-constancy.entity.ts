import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ConstancyStatus } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { User } from './user.entity';
import { Activity } from './activity.entity';
import { ActivityRegistration } from './activity-registration.entity';

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

  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity | null;

  @Column({ name: 'activity_registration_id', type: 'uuid', nullable: true })
  activityRegistrationId: string | null;

  @ManyToOne(() => ActivityRegistration, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activity_registration_id' })
  activityRegistration: ActivityRegistration | null;

  @Column({ type: 'varchar', length: 300 })
  description: string;

  /**
   * V3.2 §28.2–§28.3: `internal_constancy` la emite Afinia al confirmar;
   * `institution_certificate` lo emite la institución y lo entrega el
   * responsable. Afinia no se atribuye su autoría.
   */
  @Column({ type: 'varchar', length: 30, default: 'internal_constancy' })
  kind: 'internal_constancy' | 'institution_certificate';

  /** Emisor real del certificado institucional. */
  @Column({ name: 'issuer_name', type: 'varchar', length: 200, nullable: true })
  issuerName: string | null;

  /** El certificado entregado (archivo subido por quien lo entrega). */
  @Column({ name: 'stored_file_id', type: 'uuid', nullable: true })
  storedFileId: string | null;

  /** Código de verificación del emisor, si lo tiene. */
  @Column({ name: 'certificate_code', type: 'varchar', length: 80, nullable: true })
  certificateCode: string | null;

  @Column({ type: 'enum', enum: ConstancyStatus, default: ConstancyStatus.AUTHORIZED })
  status: ConstancyStatus;

  @Column({ name: 'authorized_by', type: 'uuid', nullable: true })
  authorizedById: string | null;

  /** Quien la emitió (V2 §30): Dirección o el responsable autorizado. */
  @Column({ name: 'issued_by', type: 'uuid', nullable: true })
  issuedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorized_by' })
  authorizedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
