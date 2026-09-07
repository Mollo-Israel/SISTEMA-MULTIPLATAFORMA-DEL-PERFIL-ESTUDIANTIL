import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AffinityLevel } from '@perfil/shared';
import { AffinitySnapshot } from './affinity-snapshot.entity';
import { AcademicArea } from './academic-area.entity';

/**
 * Puntaje de un area academica dentro de una instantanea de afinidad (RF17).
 *
 * Es la linea de detalle de `affinity_snapshots`: una fila por area con
 * puntaje. Comparando la misma area entre dos instantaneas se obtiene su
 * evolucion, que es lo que RF17 llama "actualizar".
 *
 * Se guarda tambien la posicion en el ranking porque el orden importa tanto
 * como el numero: al estudiante le orienta mas saber que un area subio al
 * primer lugar que saber que paso de 12 a 14 puntos.
 */
@Entity('affinity_snapshot_items')
@Unique('uq_affinity_snapshot_item', ['snapshotId', 'academicAreaId'])
export class AffinitySnapshotItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId: string;

  @ManyToOne(() => AffinitySnapshot, (snapshot) => snapshot.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'snapshot_id' })
  snapshot: AffinitySnapshot;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => AcademicArea, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  score: number;

  @Column({ type: 'enum', enum: AffinityLevel, enumName: 'affinity_results_level_enum' })
  level: AffinityLevel;

  /** Posicion del area en el ranking de este calculo. 1 es la mas afin. */
  @Column({ type: 'smallint' })
  rank: number;
}
