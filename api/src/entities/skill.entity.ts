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
import { AcademicArea } from './academic-area.entity';
import { StudentSkill } from './student-skill.entity';

@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  name: string;

  /**
   * Identificador estable, único y legible (p. ej. «bases_de_datos»).
   *
   * El nombre puede corregirse; el código no cambia, y es lo que conviene
   * usar para referirse a la habilidad desde importaciones o informes.
   */
  @Column({ type: 'varchar', length: 60, unique: true })
  code: string;

  @Index()
  /** Otros nombres de la misma tecnología (V2 §23.2): «ReactJS» para React. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  aliases: string[];

  @Column({ name: 'academic_area_id', type: 'uuid', nullable: true })
  academicAreaId: string | null;

  @ManyToOne(() => AcademicArea, (area) => area.skills, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => StudentSkill, (studentSkill) => studentSkill.skill)
  studentSkills: StudentSkill[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
