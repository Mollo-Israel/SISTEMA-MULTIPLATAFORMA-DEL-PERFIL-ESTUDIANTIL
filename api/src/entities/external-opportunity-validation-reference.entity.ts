import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Activity } from './activity.entity';
import { StoredFileRecord } from './stored-file.entity';

/**
 * Referencia de validación de una oportunidad externa (V3 §17).
 *
 * La registra el responsable para que la credencial que adjunte después el
 * estudiante pueda leerse y compararse: nombre esperado del curso, patrón
 * del código y un certificado de ejemplo. El proveedor, los dominios
 * oficiales y las palabras clave ya viven en la oportunidad (§12) y no se
 * duplican aquí.
 *
 * Parecerse al ejemplo nunca prueba autenticidad: solo reduce falsos
 * positivos y ayuda a extraer datos.
 */
@Entity('external_opportunity_validation_references')
export class ExternalOpportunityValidationReference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'activity_id', type: 'uuid', unique: true })
  activityId: string;

  @OneToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column({ name: 'expected_course_name', type: 'varchar', length: 200, nullable: true })
  expectedCourseName: string | null;

  /**
   * Patrón del código de credencial: `#` dígito, `@` letra, `*` varios
   * caracteres alfanuméricos; el resto, literal. Nunca una expresión regular
   * libre: compilarla desde datos de usuario abriría la puerta a un ReDoS.
   */
  @Column({ name: 'credential_id_pattern', type: 'varchar', length: 80, nullable: true })
  credentialIdPattern: string | null;

  @Column({ name: 'sample_stored_file_id', type: 'uuid', nullable: true })
  sampleStoredFileId: string | null;

  @ManyToOne(() => StoredFileRecord, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sample_stored_file_id' })
  sampleStoredFile: StoredFileRecord | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
