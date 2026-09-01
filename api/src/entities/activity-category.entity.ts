import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ActivityType } from '@perfil/shared';
import { Activity } from './activity.entity';

/**
 * Catalogo administrable de categorias de actividad (RF4).
 *
 * Antes las categorias eran un enum fijo en el codigo; el documento exige que el
 * administrador pueda registrarlas y actualizarlas como el resto de catalogos.
 *
 * `appliesTo` restringe la categoria a un tipo de actividad; en null la
 * categoria sirve para actividades academicas y extracurriculares por igual.
 */
@Entity('activity_categories')
export class ActivityCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  code: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'applies_to', type: 'enum', enum: ActivityType, nullable: true })
  appliesTo: ActivityType | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Activity, (activity) => activity.category)
  activities: Activity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
