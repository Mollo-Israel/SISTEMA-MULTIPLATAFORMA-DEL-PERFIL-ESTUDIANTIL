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
  AffinitySignalFamily,
  AffinitySignalType,
  AffinitySourceEntityType,
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

  /**
   * Familia de prueba a la que pertenece (§53, §54).
   *
   * Distinta de `signalType`: aquella dice de que tabla salio, esta de que
   * clase de prueba se trata. La regla de diversidad de §54 mira esta.
   */
  @Column({
    name: 'signal_family',
    type: 'enum',
    enum: AffinitySignalFamily,
    enumName: 'affinity_signal_family_enum',
    default: AffinitySignalFamily.OTHER,
  })
  signalFamily: AffinitySignalFamily;

  /** Tipo de registro del que salio, para poder volver a el (§56). */
  @Column({
    name: 'source_entity_type',
    type: 'enum',
    enum: AffinitySourceEntityType,
    enumName: 'affinity_source_entity_type_enum',
    nullable: true,
  })
  sourceEntityType: AffinitySourceEntityType | null;

  /** Puntos que dictaba la regla antes de aplicar rendimientos (§56). */
  @Column({ name: 'raw_points', type: 'numeric', precision: 5, scale: 2, default: 0 })
  rawPoints: number;

  /**
   * Multiplicador aplicado por rendimientos decrecientes (§51).
   *
   * Se persiste para que el desglose pueda decir <<+4 x 0,70 = 2,80>> en vez
   * de un 2,80 que nadie sabe de donde sale.
   */
  @Column({ type: 'numeric', precision: 4, scale: 2, default: 1 })
  multiplier: number;

  /**
   * Puntos finales de afinidad. Es el `final_points` de §56; conserva el
   * nombre `points` porque es el que ya leen la web y el movil.
   */
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  points: number;

  /** Puntos de respaldo que aporto esta misma senal (§53). */
  @Column({ name: 'support_points', type: 'numeric', precision: 5, scale: 2, default: 0 })
  supportPoints: number;

  /** Version del motor que produjo la linea (§56). */
  @Column({ name: 'engine_version', type: 'smallint', default: 1 })
  engineVersion: number;

  /**
   * Explicacion legible, tal como se le muestra al estudiante. Es el `reason`
   * de §56; conserva el nombre `source_label` por compatibilidad.
   */
  @Column({ name: 'source_label', type: 'varchar', length: 300 })
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
