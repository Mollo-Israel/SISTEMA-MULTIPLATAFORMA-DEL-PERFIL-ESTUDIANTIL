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
import {
  RecommendationReasonCode,
  RecommendationStatus,
  RecommendationType,
} from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { AcademicArea } from './academic-area.entity';

/** Una razon legible de por que se recomienda algo, con su peso. */
export interface RecommendationReason {
  code: RecommendationReasonCode;
  label: string;
  points: number;
}

/**
 * Recomendacion academica dirigida a un estudiante (RF18, RN-16).
 *
 * El diagrama de clases del documento modela Recommendation con tipo, titulo,
 * descripcion, enlace y fecha, y con las operaciones generate() y
 * markAsViewed(). Esta entidad es esa clase, con tres agregados que la hacen
 * defendible:
 *
 *  - `reasons`: por que se recomienda. RN-16 dice que las recomendaciones se
 *    producen "a partir del perfil estudiantil y de las afinidades
 *    identificadas"; guardar el motivo permite mostrarlo, igual que el desglose
 *    del motor de afinidad.
 *
 *  - `status`: la decision del estudiante. RN-16 dice que "el estudiante
 *    conservara la decision sobre su utilizacion". Una recomendacion descartada
 *    no vuelve a proponerse aunque el motor la genere otra vez.
 *
 *  - `isCurrent`: si el ultimo calculo la sigue produciendo. Una actividad que
 *    se cierra, o en la que el estudiante ya se inscribio, deja de ser
 *    recomendable sin que se pierda lo que el estudiante decidio sobre ella.
 *
 * `targetId` apunta a una actividad, un area academica o un perfil segun el
 * tipo. No lleva clave foranea porque el destino cambia de tabla con el tipo;
 * la vigencia la controla el propio motor en cada calculo.
 */
@Entity('recommendations')
@Unique('uq_recommendation_target', ['studentProfileId', 'type', 'targetId'])
@Index('idx_recommendation_profile_status', ['studentProfileId', 'status'])
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ type: 'enum', enum: RecommendationType, enumName: 'recommendation_type_enum' })
  type: RecommendationType;

  @Column({
    type: 'enum',
    enum: RecommendationStatus,
    enumName: 'recommendation_status_enum',
    default: RecommendationStatus.NEW,
  })
  status: RecommendationStatus;

  /** Actividad, area academica o perfil de estudiante, segun el tipo. */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid', nullable: true })
  academicAreaId: string | null;

  @ManyToOne(() => AcademicArea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Enlace externo del elemento recomendado, si lo tiene (targetLink). */
  @Column({ name: 'target_link', type: 'varchar', length: 500, nullable: true })
  targetLink: string | null;

  /** Relevancia para el estudiante. Ordena la lista; no es una nota. */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  reasons: RecommendationReason[];

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent: boolean;

  /** Huella de las reglas con que se genero, como en el motor de afinidad. */
  @Column({ name: 'rules_version', type: 'varchar', length: 64 })
  rulesVersion: string;

  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'now()' })
  generatedAt: Date;

  @Column({ name: 'viewed_at', type: 'timestamptz', nullable: true })
  viewedAt: Date | null;

  /** Momento en que el estudiante la guardo o la descarto. */
  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
