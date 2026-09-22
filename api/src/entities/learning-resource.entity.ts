import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { LearningResourceStatus, LearningResourceType } from '@perfil/shared';
import { AcademicArea } from './academic-area.entity';
import { Skill } from './skill.entity';
import { User } from './user.entity';

/**
 * Entrada del catalogo controlado de recursos y cursos externos (§61).
 *
 * El campo que da sentido a todo lo demas es `createdBy`: un recurso esta aqui
 * porque una persona concreta de la carrera decidio incluirlo, y queda
 * registrado quien fue. Eso es lo que separa un catalogo controlado de una
 * lista de enlaces recogidos automaticamente, que es lo que §61 prohibe.
 *
 * `status` existe en vez de un borrado porque §61 pide conservar la historia:
 * un recurso retirado deja de recomendarse, pero una recomendacion de hace
 * meses tiene que seguir pudiendo explicar a que apuntaba.
 */
@Entity('learning_resources')
@Index('idx_learning_resources_area_estado', ['academicAreaId', 'status'])
export class LearningResource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** Quien publica el material: la plataforma, la editorial o la institucion. */
  @Column({ type: 'varchar', length: 160 })
  provider: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid' })
  academicAreaId: string;

  @ManyToOne(() => AcademicArea, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea;

  @Column({
    name: 'resource_type',
    type: 'enum',
    enum: LearningResourceType,
    enumName: 'learning_resource_type_enum',
  })
  resourceType: LearningResourceType;

  @Column({
    type: 'enum',
    enum: LearningResourceStatus,
    enumName: 'learning_resource_status_enum',
    default: LearningResourceStatus.ACTIVE,
  })
  status: LearningResourceStatus;

  /**
   * Quien lo incorporo al catalogo (§61).
   *
   * `SET NULL` al borrar la cuenta: el recurso sigue siendo valido aunque su
   * curador ya no este, y perderlo por eso seria absurdo.
   */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @OneToMany(() => LearningResourceSkill, (s) => s.resource)
  resourceSkills: LearningResourceSkill[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Habilidad que trabaja un recurso del catalogo (§61, `skills[]`).
 *
 * Va despues de `LearningResource` a proposito: con `emitDecoratorMetadata`,
 * el tipo de una relacion se evalua al decorar, y una clase citada antes de
 * existir rompe el arranque.
 */
@Entity('learning_resource_skills')
@Unique('uq_learning_resource_skill', ['learningResourceId', 'skillId'])
export class LearningResourceSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'learning_resource_id', type: 'uuid' })
  learningResourceId: string;

  @ManyToOne(() => LearningResource, (r) => r.resourceSkills, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'learning_resource_id' })
  resource: LearningResource;

  @Index()
  @Column({ name: 'skill_id', type: 'uuid' })
  skillId: string;

  @ManyToOne(() => Skill, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
