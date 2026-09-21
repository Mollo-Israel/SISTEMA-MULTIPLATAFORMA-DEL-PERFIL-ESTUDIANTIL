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
import {
  AvailabilityStatus,
  CollaborationInterest,
  CollaborationMode,
  DEFAULT_PUBLIC_VISIBILITY,
  ProfileStatus,
  PublicProfileField,
} from '@perfil/shared';
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

  /**
   * Si el estudiante acepta aparecer como posible companero de equipo en las
   * recomendaciones de otros estudiantes (RF18, RN-16).
   *
   * Es la forma concreta del visibilityLevel que el diagrama de clases pone en
   * StudentProfile. Activo por defecto y desactivable por el propio
   * estudiante. No cambia lo que ven docentes ni director: su acceso lo
   * gobierna el alcance academico (RN-23), no esta preferencia.
   */
  @Column({ name: 'peer_discoverable', type: 'boolean', default: true })
  peerDiscoverable: boolean;

  /**
   * Disponibilidad declarada para colaborar (§17.2).
   *
   * Por defecto sin declarar: no se asume que alguien busca equipo solo
   * porque no ha tocado la pantalla.
   */
  @Column({
    type: 'enum',
    enum: AvailabilityStatus,
    default: AvailabilityStatus.UNSPECIFIED,
  })
  availability: AvailabilityStatus;

  /** Como y en que le interesa colaborar (§17.2). */
  @Column({ name: 'collaboration_preferences', type: 'jsonb', nullable: true })
  collaborationPreferences: {
    modes: CollaborationMode[];
    interests: CollaborationInterest[];
    hoursPerWeek: number | null;
    notes: string | null;
  } | null;

  /**
   * Perfil compartible activo (§44).
   *
   * Desactivado mientras el estudiante no lo active: compartir es una
   * decision, no un ajuste por omision.
   */
  @Column({ name: 'public_profile_enabled', type: 'boolean', default: false })
  publicProfileEnabled: boolean;

  /**
   * Que campos acepta mostrar, dentro de los limites del sistema (§44).
   *
   * Las claves posibles son las de `PublicProfileField` y nada mas. Lo que
   * nunca es publicable —correo institucional, archivos privados,
   * identificadores internos— no tiene clave aqui, de modo que ninguna
   * configuracion puede exponerlo.
   */
  @Column({
    name: 'public_visibility_config',
    type: 'jsonb',
    default: () => `'${JSON.stringify(DEFAULT_PUBLIC_VISIBILITY)}'::jsonb`,
  })
  publicVisibilityConfig: Record<PublicProfileField, boolean>;

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
