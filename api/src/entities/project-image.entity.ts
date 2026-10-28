import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project.entity';
import { StoredFileRecord } from './stored-file.entity';

/**
 * Imagen de muestra de un proyecto (V5 §13.4): de 0 a 5, una de portada.
 *
 * No es una evidencia. La evidencia respalda y es privada por defecto; la
 * imagen de muestra la elige el estudiante para enseñar el proyecto y solo se
 * ve donde el proyecto ya se ve.
 */
@Entity('project_images')
export class ProjectImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'stored_file_id', type: 'uuid' })
  storedFileId: string;

  @ManyToOne(() => StoredFileRecord, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stored_file_id' })
  storedFile: StoredFileRecord;

  @Column({ type: 'smallint' })
  position: number;

  @Column({ name: 'is_cover', type: 'boolean', default: false })
  isCover: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
