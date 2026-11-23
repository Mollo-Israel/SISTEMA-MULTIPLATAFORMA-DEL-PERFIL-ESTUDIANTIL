import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StudentProfile } from './student-profile.entity';

/** De qué hecho registrado nace el registro verificable. */
export type CredentialSourceType = 'participation' | 'institution_certificate' | 'internal_constancy';

/**
 * Registro verificable (V8 · credenciales verificables).
 *
 * Es la versión firmada de un hecho que Afinia ya registra: una participación
 * confirmada, un certificado que la institución entregó con su emisor real o
 * una constancia histórica. No es un certificado académico (V5 §1.2, ND-01):
 * dice lo que el sistema registró, con firma digital, para que un tercero
 * pueda comprobarlo sin pedir acceso.
 *
 * Lo firmado no cambia nunca. Un trigger de la base rechaza cualquier cambio
 * en el código, el documento firmado o su huella; solo la suspensión y la
 * revocación se escriben después, y la revocación no se puede deshacer.
 */
@Entity('verifiable_credentials')
@Index('UQ_verifiable_credentials_source', ['sourceType', 'sourceId'], { unique: true })
export class VerifiableCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código público para verificar: AF-XXXX-XXXX-XXXX (60 bits aleatorios + control). */
  @Index('UQ_verifiable_credentials_code', { unique: true })
  @Column({ name: 'public_code', type: 'varchar', length: 20 })
  publicCode: string;

  @Column({ name: 'source_type', type: 'varchar', length: 30 })
  sourceType: CredentialSourceType;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ name: 'activity_id', type: 'uuid', nullable: true })
  activityId: string | null;

  @Column({ name: 'achievement_name', type: 'varchar', length: 300 })
  achievementName: string;

  @Column({ name: 'holder_name', type: 'varchar', length: 200 })
  holderName: string;

  /** Quién firma: siempre Afinia. */
  @Column({ name: 'issuer_name', type: 'varchar', length: 200 })
  issuerName: string;

  /** Emisor real del documento entregado (certificado institucional). */
  @Column({ name: 'document_issuer', type: 'varchar', length: 200, nullable: true })
  documentIssuer: string | null;

  /** SHA-256 del archivo entregado, para reconocerlo byte a byte. */
  @Column({ name: 'document_sha256', type: 'char', length: 64, nullable: true })
  documentSha256: string | null;

  /** Fecha del hecho (la actividad), si se conoce. */
  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt: Date | null;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  /** Open Badges 3.0 con prueba Data Integrity `eddsa-jcs-2022`. */
  @Column({ name: 'credential_json', type: 'jsonb' })
  credentialJson: Record<string, unknown>;

  /** La misma credencial como VC-JWT (EdDSA). */
  @Column({ name: 'credential_jwt', type: 'text' })
  credentialJwt: string;

  /** SHA-256 del JSON canónico (JCS) firmado. Queda también en la bitácora. */
  @Column({ name: 'payload_sha256', type: 'char', length: 64 })
  payloadSha256: string;

  @Column({ name: 'key_id', type: 'varchar', length: 40 })
  keyId: string;

  /** Posición en las listas de estado (revocación y suspensión). */
  @Index('UQ_verifiable_credentials_status_index', { unique: true })
  @Column({ name: 'status_index', type: 'int' })
  statusIndex: number;

  /** Sal del correo con hash de Open Badges 2.0. */
  @Column({ name: 'recipient_salt', type: 'varchar', length: 32 })
  recipientSalt: string;

  @Column({ name: 'recipient_hash', type: 'varchar', length: 80 })
  recipientHash: string;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt: Date | null;

  @Column({ name: 'suspended_by', type: 'uuid', nullable: true })
  suspendedBy: string | null;

  @Column({ name: 'suspension_reason', type: 'varchar', length: 500, nullable: true })
  suspensionReason: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy: string | null;

  @Column({ name: 'revocation_reason', type: 'varchar', length: 500, nullable: true })
  revocationReason: string | null;

  @Column({ name: 'issued_by', type: 'uuid', nullable: true })
  issuedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
