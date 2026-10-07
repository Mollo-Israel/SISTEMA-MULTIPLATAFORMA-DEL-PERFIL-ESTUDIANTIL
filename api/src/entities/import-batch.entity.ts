import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ImportBatchStatus, ImportRowStatus } from '@perfil/shared';
import { User } from './user.entity';

/**
 * Lote de importacion de padron (especificacion §10).
 *
 * Se persiste el lote entero —incluida la previsualizacion descartada— porque
 * §10.4 exige poder responder despues quien importo que, cuando y con que
 * resultado. El hash del archivo permite reconocer una reimportacion identica.
 */
/** Tipo de padrón (V3 §7.1). */
export type ImportKind = 'students' | 'teachers';

@Entity('import_batches')
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename: string;

  /** SHA-256 del archivo tal como se recibio. */
  @Index()
  @Column({ name: 'file_sha256', type: 'varchar', length: 64 })
  fileSha256: string;

  @Column({
    type: 'enum',
    enum: ImportBatchStatus,
    enumName: 'import_batch_status_enum',
    default: ImportBatchStatus.PREVIEWED,
  })
  status: ImportBatchStatus;

  /** Padrón de estudiantes o de docentes (V3 §7.1). */
  @Column({ type: 'varchar', length: 20, default: 'students' })
  kind: ImportKind;

  @Column({ name: 'imported_by_user_id', type: 'uuid' })
  importedByUserId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'imported_by_user_id' })
  importedBy: User;

  /** Conteo por estado de fila. Evita recontar el detalle para mostrar el resumen. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  counts: Record<ImportRowStatus, number> | Record<string, number>;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows: number;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt: Date | null;

  @OneToMany(() => ImportBatchRow, (row) => row.batch)
  rows: ImportBatchRow[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/**
 * Una fila del archivo, con el veredicto que produjo.
 *
 * Se guarda el dato normalizado y el motivo del rechazo para que el
 * administrador pueda corregir el archivo sin adivinar.
 */
@Entity('import_batch_rows')
@Index(['batchId', 'status'])
export class ImportBatchRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @ManyToOne(() => ImportBatch, (batch) => batch.rows, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batch_id' })
  batch: ImportBatch;

  /** Numero de linea en el archivo original, para senalar el error. */
  @Column({ name: 'row_number', type: 'int' })
  rowNumber: number;

  @Column({ name: 'university_code', type: 'varchar', length: 40, nullable: true })
  universityCode: string | null;

  @Column({ name: 'institutional_email', type: 'varchar', length: 160, nullable: true })
  institutionalEmail: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Column({ type: 'int', nullable: true })
  semester: number | null;

  /** Semestres autorizados de una fila de docente (V3 §7.1). */
  @Column({ type: 'smallint', array: true, nullable: true })
  semesters: number[] | null;

  @Column({
    type: 'enum',
    enum: ImportRowStatus,
    enumName: 'import_row_status_enum',
  })
  status: ImportRowStatus;

  /** Por que la fila es INVALID o CONFLICT. Vacio en el resto de casos. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  message: string | null;

  /** Usuario creado o actualizado al aplicar. Nulo mientras sea previsualizacion. */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
