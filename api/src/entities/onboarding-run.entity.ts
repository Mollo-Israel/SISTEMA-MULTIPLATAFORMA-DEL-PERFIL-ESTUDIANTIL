import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OnboardingRunStatus } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';

// `OnboardingRun` va primero a proposito: `emitDecoratorMetadata` evalua el
// tipo de `OnboardingAnswer.run` en el momento de decorar, y con el orden
// inverso la clase aun no existe. El `@OneToMany` de vuelta no tiene ese
// problema porque su referencia vive dentro de una funcion.
/**
 * Una pasada completa del Cuestionario Inicial de Orientación Académica (§16).
 *
 * El cuestionario puede repetirse, asi que puede haber varias ejecuciones por
 * estudiante; solo una esta vigente y las anteriores quedan como
 * `superseded`. Se conserva version, fecha, respuestas y resultado, que es
 * exactamente lo que §16 exige guardar.
 *
 * Su resultado **no alimenta la afinidad por si solo**: lo unico que produce
 * son areas sugeridas, y hasta que el estudiante confirma cuales quiere, no
 * existe ningun interes.
 */
@Entity('onboarding_runs')
export class OnboardingRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  /** Version del banco de preguntas con la que se respondio. */
  @Column({ name: 'questionnaire_version', type: 'smallint' })
  questionnaireVersion: number;

  @Column({ type: 'enum', enum: OnboardingRunStatus, default: OnboardingRunStatus.COMPLETED })
  status: OnboardingRunStatus;

  /**
   * Areas sugeridas y su puntaje, en orden descendente.
   *
   * Se persiste el resultado, no solo las respuestas: el banco de preguntas
   * puede cambiar y el estudiante tiene derecho a ver el mismo resultado que
   * vio el dia que respondio.
   */
  @Column({ name: 'suggested_areas', type: 'jsonb', default: () => "'[]'::jsonb" })
  suggestedAreas: { academicAreaId: string; name: string; score: number }[];

  /** Areas que el estudiante decidio incorporar al confirmar. */
  @Column({ name: 'confirmed_area_ids', type: 'uuid', array: true, nullable: true })
  confirmedAreaIds: string[] | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @OneToMany(() => OnboardingAnswer, (answer) => answer.run)
  answers: OnboardingAnswer[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Una respuesta concreta dentro de una ejecucion.
 *
 * Se guardan los codigos de opcion tal cual se eligieron, no las areas que
 * salieron de ellos: si el cuestionario cambia de version, la respuesta
 * original sigue siendo legible con el banco de preguntas de su version.
 */
@Entity('onboarding_answers')
export class OnboardingAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => OnboardingRun, (run) => run.answers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'run_id' })
  run: OnboardingRun;

  @Column({ name: 'question_code', type: 'varchar', length: 60 })
  questionCode: string;

  /** Codigos de opcion elegidos. Una sola entrada si la pregunta es simple. */
  @Column({ name: 'option_codes', type: 'varchar', length: 60, array: true })
  optionCodes: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
