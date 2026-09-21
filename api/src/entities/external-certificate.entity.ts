import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { AcademicArea } from './academic-area.entity';
import { StoredFileRecord } from './stored-file.entity';

/**
 * Certificado emitido por una entidad externa y adjuntado por el estudiante.
 *
 * El sistema NO certifica ni valida legalmente el documento: lo registra como
 * evidencia externa dentro del perfil.
 */
@Entity('external_certificates')
export class ExternalCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, (profile) => profile.externalCertificates, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ name: 'certificate_name', type: 'varchar', length: 200 })
  certificateName: string;

  @Column({ type: 'varchar', length: 160 })
  issuer: string;

  @Column({ name: 'certificate_url', type: 'varchar', length: 500, nullable: true })
  certificateUrl: string | null;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate: string | null;

  /**
   * Identificador que imprime el emisor (§30).
   *
   * Se compara con el que el validador lea del documento: si coinciden, es
   * una senal de que lo declarado corresponde al papel.
   */
  @Column({ name: 'credential_id', type: 'varchar', length: 80, nullable: true })
  credentialId: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Index()
  @Column({ name: 'academic_area_id', type: 'uuid', nullable: true })
  academicAreaId: string | null;

  @ManyToOne(() => AcademicArea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'academic_area_id' })
  academicArea: AcademicArea | null;

  /** Archivo adjunto del certificado; alternativo al enlace externo. */
  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 160, nullable: true })
  fileName: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType: string | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  /**
   * Archivo adjunto como entidad con dueno (§27.2).
   *
   * Las columnas `file_url`, `file_name`, `mime_type` y `file_size` se
   * conservan porque las consultan las vistas existentes, pero la fuente de
   * verdad es esta: es la unica que sabe quien subio el archivo y cual es su
   * huella.
   */
  @Index()
  @Column({ name: 'stored_file_id', type: 'uuid', nullable: true })
  storedFileId: string | null;

  @ManyToOne(() => StoredFileRecord, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stored_file_id' })
  storedFile: StoredFileRecord | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
