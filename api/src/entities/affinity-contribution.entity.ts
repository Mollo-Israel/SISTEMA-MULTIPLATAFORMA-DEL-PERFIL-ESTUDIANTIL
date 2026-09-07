import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  AffinityMatchType,
  AffinitySignalType,
  AffinityWeightCode,
} from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { AcademicArea } from './academic-area.entity';

/**
 * Una linea del desglose que explica un puntaje de afinidad (RF17, RN-14).
 *
 * El motor ya calculaba un numero, pero el estudiante no tenia forma de saber
 * de donde salia. RN-15 dice que la afinidad es orientacion: una orientacion
 * que no se puede explicar es una caja negra, y un tribunal la cuestiona con
 * razon.
 *
 * Cada fila responde una pregunta concreta: que sumo, cuanto sumo, a que area
 * y por que se asocio a esa area. Ejemplo legible:
 *
 *   "Proyecto propio: Sistema de riego inteligente" -> Desarrollo Movil,
 *   +5.00 puntos, area declarada por el estudiante.
 *
 * VIGENCIA: las contribuciones describen el ULTIMO calculo del perfil. Cada
 * recalculo las reemplaza dentro de la misma transaccion que reescribe los
 * resultados, de modo que el desglose nunca queda desincronizado del puntaje
 * que explica. La evolucion historica vive en `affinity_snapshots`.
 */
@Entity('affinity_contributions')
@Index('idx_affinity_contribution_profile_area', ['studentProfileId', 'academicAreaId'])
export class AffinityContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => AcademicArea, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;

  /** Familia de senal, para agrupar el desglose por origen. */
  @Column({
    name: 'signal_type',
    type: 'enum',
    enum: AffinitySignalType,
    enumName: 'affinity_signal_type_enum',
  })
  signalType: AffinitySignalType;

  /** Regla concreta que se aplico. Referencia a `affinity_weights.code`. */
  @Column({
    name: 'weight_code',
    type: 'enum',
    enum: AffinityWeightCode,
    enumName: 'affinity_weight_code_enum',
  })
  weightCode: AffinityWeightCode;

  /** Si el area venia declarada o el sistema la dedujo, y como. */
  @Column({
    name: 'match_type',
    type: 'enum',
    enum: AffinityMatchType,
    enumName: 'affinity_match_type_enum',
  })
  matchType: AffinityMatchType;

  /** Puntos que aporto esta senal en concreto. */
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  points: number;

  /** Descripcion legible del origen, tal como se le muestra al estudiante. */
  @Column({ name: 'source_label', type: 'varchar', length: 200 })
  sourceLabel: string;

  /**
   * Identificador del registro de origen (proyecto, actividad, certificado).
   * Sin clave foranea a proposito: apunta a tablas distintas segun la senal, y
   * el desglose debe sobrevivir aunque ese registro se elimine despues.
   */
  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
