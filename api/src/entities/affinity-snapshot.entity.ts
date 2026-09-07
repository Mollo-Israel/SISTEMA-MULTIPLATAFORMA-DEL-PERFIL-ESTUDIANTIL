import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AffinityCalculationStatus } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { AffinitySnapshotItem } from './affinity-snapshot-item.entity';

/**
 * Instantanea de una ejecucion del motor de afinidad (RF17).
 *
 * RF17 pide "calcular, ACTUALIZAR y permitir consultar" las afinidades. Sin
 * historial, "actualizar" es indistinguible de "sobrescribir": no hay forma de
 * ver como evoluciono la orientacion del estudiante ni de auditar un calculo
 * anterior.
 *
 * Cada recalculo deja una fila con el encabezado y sus lineas por area en
 * `affinity_snapshot_items`. Es deliberadamente ligero -del orden de una fila
 * por area- para que conservar historia no cueste caro.
 *
 * LIMITE DE ALCANCE: esto es historia, no prediccion. Las estimaciones de
 * tendencias son el decimo objetivo especifico y RN-15 prohibe expresamente
 * usar estos datos para evaluar rendimiento o anticipar resultados academicos.
 */
@Entity('affinity_snapshots')
@Index('idx_affinity_snapshot_profile_date', ['studentProfileId', 'calculatedAt'])
export class AffinitySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  /**
   * Distingue un calculo con resultado de uno sin datos suficientes. RF17
   * exige informar ese caso de forma explicita, no como una lista vacia.
   */
  @Column({
    type: 'enum',
    enum: AffinityCalculationStatus,
    enumName: 'affinity_calculation_status_enum',
  })
  status: AffinityCalculationStatus;

  /** Suma de los puntajes de todas las areas en este calculo. */
  @Column({ name: 'total_score', type: 'numeric', precision: 8, scale: 2, default: 0 })
  totalScore: number;

  /** Cuantas areas obtuvieron puntaje. */
  @Column({ name: 'areas_count', type: 'smallint', default: 0 })
  areasCount: number;

  /** Cuantas senales individuales alimentaron el calculo. */
  @Column({ name: 'signals_count', type: 'smallint', default: 0 })
  signalsCount: number;

  /**
   * Huella de las ponderaciones vigentes al calcular. Si las reglas cambian,
   * la huella cambia, y se puede distinguir una variacion de puntaje causada
   * por nueva actividad del estudiante de una causada por un ajuste de reglas.
   */
  @Column({ name: 'rules_version', type: 'varchar', length: 64 })
  rulesVersion: string;

  @OneToMany(() => AffinitySnapshotItem, (item) => item.snapshot)
  items: AffinitySnapshotItem[];

  @CreateDateColumn({ name: 'calculated_at' })
  calculatedAt: Date;
}
