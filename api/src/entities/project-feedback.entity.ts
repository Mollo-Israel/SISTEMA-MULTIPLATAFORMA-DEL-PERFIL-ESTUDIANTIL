import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from './user.entity';

/**
 * Retroalimentacion academica basica de un docente sobre un proyecto (RF16).
 *
 * ALCANCE (RN-13): es orientacion academica complementaria. NO es una nota, ni
 * una evaluacion oficial, ni un juicio de aprobacion. Por eso la entidad no
 * tiene puntaje, rubrica ni estado de aprobacion: solo un comentario.
 *
 * El docente que la escribio se conserva con ON DELETE RESTRICT: la historia
 * academica no debe quedar huerfana ni desaparecer en silencio.
 */
@Entity('project_feedback')
export class ProjectFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.feedback, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Index()
  @Column({ name: 'teacher_user_id', type: 'uuid' })
  teacherUserId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_user_id' })
  teacher: User;

  @Column({ type: 'varchar', length: 1000 })
  comment: string;

  /** Se completa solo si el docente edita su propio comentario. */
  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
