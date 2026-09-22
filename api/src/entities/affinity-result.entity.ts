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
import { AffinityLevel } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { AcademicArea } from './academic-area.entity';

@Entity('affinity_results')
@Unique('uq_affinity_result', ['studentProfileId', 'academicAreaId'])
export class AffinityResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, (profile) => profile.affinityResults, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => AcademicArea, (area) => area.affinityResults, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;

  /**
   * AFFINITY_SCORE de §49: de 0 a 100, normalizado contra el maximo teorico.
   *
   * Hasta el motor V1 este campo guardaba puntos crudos sin techo. Ahora es un
   * porcentaje comparable entre areas, entre estudiantes y -lo que importa
   * mas- entre dos momentos del mismo estudiante (§52).
   */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  score: number;

  /**
   * Puntos crudos antes de normalizar, sobre 60 (§52).
   *
   * Se guarda porque es lo que suman las contribuciones del desglose. Sin el,
   * el estudiante veria lineas que suman 21 y un puntaje de 35 sin forma de
   * atar una cosa con la otra.
   */
  @Column({ name: 'raw_points', type: 'numeric', precision: 6, scale: 2, default: 0 })
  rawPoints: number;

  @Column({ type: 'enum', enum: AffinityLevel, default: AffinityLevel.LOW })
  level: AffinityLevel;

  /**
   * SUPPORT_SCORE de §49: cuanta informacion trazable sostiene la afinidad.
   *
   * Responde una pregunta distinta de la del puntaje de afinidad y por eso es
   * un numero aparte. Se puede tener afinidad alta con respaldo bajo -alguien
   * que declara mucho y aun no ha podido demostrar nada- y eso es informacion
   * util, no una contradiccion.
   */
  @Column({ name: 'support_score', type: 'smallint', default: 0 })
  supportScore: number;

  @Column({
    name: 'support_level',
    type: 'enum',
    enum: AffinityLevel,
    enumName: 'affinity_results_level_enum',
    default: AffinityLevel.LOW,
  })
  supportLevel: AffinityLevel;

  /**
   * Familias independientes que aportaron respaldo (§54).
   *
   * Se persisten porque son la razon por la que un respaldo de 70 puede
   * quedarse en MEDIUM: con una sola familia detras, el numero bruto no basta.
   * Guardarlas permite explicarlo en vez de que parezca un error de calculo.
   */
  @Column({ name: 'support_families', type: 'text', array: true, default: () => "'{}'" })
  supportFamilies: string[];

  /** Version del motor que produjo esta fila (§56). */
  @Column({ name: 'engine_version', type: 'smallint', default: 1 })
  engineVersion: number;

  @CreateDateColumn({ name: 'calculated_at' })
  calculatedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
