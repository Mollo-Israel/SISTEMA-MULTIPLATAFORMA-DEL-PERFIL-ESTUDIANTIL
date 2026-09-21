import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Metadatos de un archivo subido (especificacion §27.2).
 *
 * Antes estos datos vivian dispersos en cada evidencia y cada certificado como
 * columnas sueltas —`file_url`, `file_name`, `mime_type`, `file_size`— y el
 * cliente enviaba la URL al adjuntar. Eso permitia adjuntar la URL de otra
 * persona y, como la autorizacion de descarga se resuelve mirando a quien
 * pertenece la evidencia, ganar acceso a un archivo ajeno.
 *
 * Ahora el archivo es una entidad con dueno. Adjuntarlo consiste en nombrar su
 * identificador, y el servidor comprueba que quien lo nombra es quien lo subio.
 */
@Entity('stored_files')
export class StoredFileRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nombre del archivo dentro del almacenamiento. Lo genera el sistema. */
  @Index({ unique: true })
  @Column({ name: 'storage_key', type: 'varchar', length: 200 })
  storageKey: string;

  /** Nombre con el que lo subio la persona, ya saneado, solo para mostrarlo. */
  @Column({ name: 'original_filename', type: 'varchar', length: 160 })
  originalFilename: string;

  /** Lo que el cliente dijo que era. No se confia en esto para nada. */
  @Column({ name: 'mime_type_declared', type: 'varchar', length: 120 })
  mimeTypeDeclared: string;

  /**
   * Lo que el archivo es en realidad, leido de su firma.
   *
   * Es el que manda: un `.pdf` cuyo contenido es un ejecutable se rechaza
   * aunque el cliente jure que es un PDF.
   */
  @Column({ name: 'mime_type_detected', type: 'varchar', length: 120 })
  mimeTypeDetected: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  /**
   * Huella del contenido (§28).
   *
   * Dos subidas del mismo archivo comparten hash. Eso permite detectar el
   * duplicado y evitar que el mismo documento multiplique respaldo o afinidad.
   */
  @Index()
  @Column({ name: 'sha256', type: 'char', length: 64 })
  sha256: string;

  @Index()
  @Column({ name: 'uploaded_by_user_id', type: 'uuid' })
  uploadedByUserId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy: User;

  /**
   * Archivo anterior con el mismo contenido del mismo dueno, si lo hay (§28).
   *
   * No se rechaza la subida: la misma constancia puede respaldar legitimamente
   * dos cosas distintas. Lo que no debe ocurrir es que cuente dos veces, y para
   * decidirlo hace falta saber que es la misma.
   */
  @Column({ name: 'duplicate_of_id', type: 'uuid', nullable: true })
  duplicateOfId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
