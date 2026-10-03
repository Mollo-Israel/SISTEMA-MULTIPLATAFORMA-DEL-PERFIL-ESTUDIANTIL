import {
  BeforeInsert,
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
  PUBLIC_SLUG_ALPHABET,
  PUBLIC_SLUG_LENGTH,
} from '@perfil/shared';
import { randomInt } from 'crypto';
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
  /**
   * Identificador publico opaco del perfil compartible (§43).
   *
   * §43 prohibe usar el correo, el codigo universitario o el UUID interno: un
   * identificador que se pueda adivinar o que revele algo deja de ser opaco.
   * Se puede rotar, y rotarlo invalida los QR impresos antes, que es justo
   * para lo que sirve.
   */
  @Index({ unique: true })
  @Column({ name: 'public_profile_slug', type: 'varchar', length: 24 })
  publicProfileSlug: string;

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

  /**
   * Cuándo empezó el estudiante su perfil.
   *
   * El alta crea el perfil con los datos institucionales; el estudiante lo
   * reclama al completar lo suyo. Null: nadie lo ha tocado todavía.
   */
  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  /** Último paso alcanzado del asistente de bienvenida. */
  @Column({ name: 'onboarding_step', type: 'varchar', length: 30, nullable: true })
  onboardingStep: string | null;

  /** Cuándo terminó la bienvenida. Hasta entonces, el resto del sistema espera. */
  @Column({ name: 'onboarding_completed_at', type: 'timestamptz', nullable: true })
  onboardingCompletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Asigna el identificador publico al crear el perfil (§43).
   *
   * Va en la entidad y no en el servicio a proposito: hay varios caminos por
   * los que nace un perfil -el estudiante, el padron, la siembra- y uno solo
   * que se olvide dejaria una fila sin identificador, que la base rechaza.
   *
   * No se comprueba la unicidad contra la base: doce simbolos de un alfabeto
   * de veintiocho son 2,4 x 10^17 combinaciones, y con cien mil perfiles la
   * probabilidad de choque esta en el orden de 10^-8. La restriccion unica de
   * la tabla queda como red de seguridad para ese caso.
   */
  @BeforeInsert()
  asignarSlugPublico(): void {
    if (this.publicProfileSlug) return;
    let slug = '';
    for (let i = 0; i < PUBLIC_SLUG_LENGTH; i++) {
      slug += PUBLIC_SLUG_ALPHABET[randomInt(PUBLIC_SLUG_ALPHABET.length)];
    }
    this.publicProfileSlug = slug;
  }
}
