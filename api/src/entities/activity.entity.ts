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
import {
  ActivityModality,
  ActivityStatus,
  ActivityType,
  RegistrationMode,
} from '@perfil/shared';
import { User } from './user.entity';
import { AcademicArea } from './academic-area.entity';
import { ActivityCategory } from './activity-category.entity';
import { ActivityRegistration } from './activity-registration.entity';
import { ActivitySkill } from './activity-skill.entity';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'enum', enum: ActivityType })
  type: ActivityType;

  /** Categoria del catalogo administrable (RF4). */
  @Index()
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => ActivityCategory, (category) => category.activities, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: ActivityCategory;

  @Column({ type: 'enum', enum: ActivityModality, default: ActivityModality.PRESENCIAL })
  modality: ActivityModality;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ name: 'external_url', type: 'varchar', length: 500, nullable: true })
  externalUrl: string | null;

  @Column({ name: 'evidence_required', type: 'boolean', default: false })
  evidenceRequired: boolean;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid', nullable: true })
  academicAreaId: string | null;

  @ManyToOne(() => AcademicArea, (area) => area.activities, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea | null;

  @Index()
  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  /**
   * Inicio de la actividad.
   *
   * Se conserva el nombre `event_date` de la columna: es la misma fecha que
   * siempre fue, y renombrarla obligaria a tocar consultas y datos sin
   * ganar nada. §22 la llama `start_at`.
   */
  @Column({ name: 'event_date', type: 'timestamptz', nullable: true })
  eventDate: Date | null;

  /** Fin de la actividad (§22, `end_at`). Nulo si dura un solo momento. */
  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date | null;

  /**
   * Semestres a los que va dirigida (§22, `semester_scope`).
   *
   * Vacio o nulo significa «toda la carrera». Para un docente no es
   * decorativo: es lo que delimita que puede gestionar, y el servidor
   * comprueba que no declare semestres fuera de los suyos.
   */
  @Column({ name: 'semester_scope', type: 'smallint', array: true, nullable: true })
  semesterScope: number[] | null;

  /** Como se entra (§22, `registration_mode`). */
  @Column({
    name: 'registration_mode',
    type: 'enum',
    enum: RegistrationMode,
    default: RegistrationMode.OPEN,
  })
  registrationMode: RegistrationMode;

  /** Requisitos previos, en texto libre (§22, `requirements`). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  requirements: string | null;

  /**
   * Quien responde por la actividad (§22, `responsible_user_id`).
   *
   * Distinto de `creator_id`: quien la creo puede dejar el cargo, y la
   * actividad sigue necesitando a alguien que confirme participaciones.
   * Por defecto es su creador.
   */
  @Index()
  @Column({ name: 'responsible_user_id', type: 'uuid', nullable: true })
  responsibleUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responsible_user_id' })
  responsible: User | null;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Index()
  @Column({ type: 'enum', enum: ActivityStatus, default: ActivityStatus.DRAFT })
  status: ActivityStatus;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @OneToMany(() => ActivityRegistration, (reg) => reg.activity)
  registrations: ActivityRegistration[];

  /** Habilidades que la actividad trabaja (§22, §73.3). */
  @OneToMany(() => ActivitySkill, (link) => link.activity)
  activitySkills: ActivitySkill[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
