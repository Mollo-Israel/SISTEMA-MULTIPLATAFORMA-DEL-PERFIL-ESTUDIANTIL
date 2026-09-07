import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AffinitySignalType, AffinityWeightCode } from '@perfil/shared';

/**
 * Ponderacion configurable del motor de afinidad (RN-14).
 *
 * RN-14 exige que el calculo se realice "mediante reglas, etiquetas,
 * puntuaciones, coincidencias y mecanismos de ponderacion definidos para el
 * sistema". Antes esos pesos vivian como una constante dentro del codigo
 * fuente: el resultado no era auditable y nadie fuera del repositorio podia
 * saber que regla se habia aplicado.
 *
 * Ahora cada peso es una fila. Eso permite:
 *  - registrar en cada calculo la version de reglas que se uso;
 *  - explicar al estudiante cuanto sumo cada senal y por que;
 *  - revisar las ponderaciones sin recompilar el sistema.
 *
 * NO existe pantalla de administracion de pesos: ningun requerimiento
 * funcional del documento la concede. Son configuracion del sistema, sembrada
 * por la migracion, no un catalogo editable como los de RF4.
 */
@Entity('affinity_weights')
@Unique('uq_affinity_weight_code', ['code'])
export class AffinityWeight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Identificador estable de la regla. El motor la busca por este codigo. */
  @Column({ type: 'enum', enum: AffinityWeightCode, enumName: 'affinity_weight_code_enum' })
  code: AffinityWeightCode;

  /** Familia de senal a la que pertenece, para agrupar la explicacion. */
  @Column({
    name: 'signal_type',
    type: 'enum',
    enum: AffinitySignalType,
    enumName: 'affinity_signal_type_enum',
  })
  signalType: AffinitySignalType;

  /** Puntos que aporta la senal cada vez que se cumple. */
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  points: number;

  /** Texto corto que se muestra al estudiante en el desglose. */
  @Column({ type: 'varchar', length: 120 })
  label: string;

  /** Justificacion de la ponderacion, para la defensa y la auditoria. */
  @Column({ type: 'varchar', length: 400 })
  description: string;

  /**
   * Una regla desactivada deja de sumar, pero no se borra: los calculos
   * anteriores que la usaron siguen siendo explicables.
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
