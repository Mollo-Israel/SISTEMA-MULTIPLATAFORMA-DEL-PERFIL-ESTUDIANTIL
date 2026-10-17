import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GamificationTrigger } from '@perfil/shared';
import { AcademicArea } from './academic-area.entity';

/**
 * Criterio de gamificacion administrable (RF4).
 *
 * ALCANCE: en el 40% esta entidad se administra de forma real y persistente,
 * pero NINGUN modulo la consume todavia: el motor de gamificacion pertenece a
 * una fase posterior. Se deja definida para que ese modulo la lea sin cambiar
 * el esquema. No se generan puntos ni insignias en esta iteracion.
 */
@Entity('gamification_criteria')
export class GamificationCriterion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: GamificationTrigger })
  trigger: GamificationTrigger;

  @Column({ type: 'int', default: 0 })
  @Check('chk_gamification_points', 'points >= 0 AND points <= 1000')
  points: number;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid', nullable: true })
  academicAreaId: string | null;

  @ManyToOne(() => AcademicArea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /**
   * V4.1 A41-016 (§9.3, A.10): extra de temporada. Un bono suma ADEMÁS de los
   * puntos del hecho, solo dentro de su vigencia (hora de Bolivia) y, si tiene
   * área, solo en hechos de esa área. No puntúa afinidad.
   */
  @Column({ name: 'is_bonus', type: 'boolean', default: false })
  isBonus: boolean;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: string | null;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
