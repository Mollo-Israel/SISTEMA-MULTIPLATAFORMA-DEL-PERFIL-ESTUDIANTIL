import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Activity } from './activity.entity';
import { Skill } from './skill.entity';

/**
 * Habilidad que una actividad trabaja (especificacion §22, §73.3).
 *
 * Hasta ahora una actividad solo declaraba su area academica, de modo que
 * participar en un taller de React y en uno de bases de datos aportaba lo mismo
 * si ambos estaban en la misma area. Declarar las habilidades permite que la
 * participacion confirmada diga *que* se trabajo, no solo donde.
 *
 * Es lo que declara quien organiza, no una medicion: que una actividad trabaje
 * React no significa que quien asistio sepa React. Alimenta respaldo y
 * recomendaciones, nunca una autoevaluacion ajena.
 */
@Entity('activity_skills')
@Unique('uq_activity_skill', ['activityId', 'skillId'])
export class ActivitySkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @ManyToOne(() => Activity, (activity) => activity.activitySkills, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Index()
  @Column({ name: 'skill_id', type: 'uuid' })
  skillId: string;

  @ManyToOne(() => Skill, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
