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
import { StudentProfile } from './student-profile.entity';

/**
 * Interes declarado en texto libre por el estudiante (RF5).
 *
 * El documento distingue cuatro datos declarativos del perfil: intereses,
 * habilidades, areas de preferencia y areas de mejora. Esta entidad cubre los
 * *intereses* propiamente dichos: temas que el estudiante escribe con sus
 * palabras y que no tienen por que existir en el catalogo de areas
 * ("Desarrollo de videojuegos", "Automatizacion", "IA aplicada a salud").
 *
 * Las *areas de preferencia* son otra cosa y viven en student_interests, que es
 * la seleccion estructurada del catalogo de areas academicas con prioridad.
 */
// El unico por (perfil, nombre) se define en la migracion como indice
// funcional sobre lower(name): TypeORM no expresa indices funcionales.
@Entity('student_free_interests')
export class StudentFreeInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
