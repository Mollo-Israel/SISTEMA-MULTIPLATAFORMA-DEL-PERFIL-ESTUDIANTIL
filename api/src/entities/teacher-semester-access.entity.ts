import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Semestres habilitados para que un docente consulte perfiles de estudiantes.
 * Relacion N:M normalizada entre usuario (docente) y semestre, administrada
 * unicamente por el administrador (RF3).
 */
@Entity('teacher_semester_access')
@Unique('uq_teacher_semester', ['teacherId', 'semester'])
@Check('chk_teacher_semester_range', 'semester >= 1 AND semester <= 8')
export class TeacherSemesterAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ type: 'smallint' })
  semester: number;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'granted_by' })
  grantedBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
