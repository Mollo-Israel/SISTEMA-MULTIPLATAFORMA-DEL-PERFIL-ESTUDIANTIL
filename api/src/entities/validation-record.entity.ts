import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  BackingTier,
  CredentialCheckStatus,
  IdentityMatchStatus,
  LinkCheckStatus,
  ManualReviewStatus,
  QrPresence,
  ValidationResourceType,
  ValidationStatus,
} from '@perfil/shared';

/** Metadata que la extraccion documental intenta encontrar (§29). */
export interface ExtractedDocumentData {
  holderName: string | null;
  issuer: string | null;
  certificateTitle: string | null;
  issueDate: string | null;
  credentialId: string | null;
  verificationUrl: string | null;
  /** De donde salio el texto: del PDF, del OCR o de un QR. */
  source: 'pdf_text' | 'ocr' | 'qr' | 'none';
  /** Cuantos caracteres utiles se leyeron. Sirve para explicar un INCONCLUSIVE. */
  textLength: number;
  /** Contenido de los QR encontrados, si los hubo. */
  qrPayloads?: string[];
}

/**
 * Verificación escalonada de una credencial externa (V3 §18).
 *
 * Se guarda lo que se comprobó y por qué, para poder explicarlo: el nivel
 * de respaldo nunca es una caja negra.
 */
export interface CredentialCheckResult {
  status: CredentialCheckStatus;
  /** URL consultada (declarada, del QR o de la insignia) y adónde llevó. */
  url: string | null;
  urlSource: 'declared' | 'qr' | 'document' | 'badge' | null;
  finalUrl: string | null;
  /** ¿Dominio oficial? `null` si no había base para juzgarlo. */
  official: boolean | null;
  officialDomains: string[] | null;
  qr: QrPresence;
  /** Qué encontró en la página oficial. */
  page: { credentialId: boolean; holder: boolean; course: boolean; issuer: boolean } | null;
  openBadge: {
    format: string; recipientMatch: boolean | null; revoked: boolean;
    hosted: boolean; proofPresent: boolean; proofVerified: boolean;
  } | null;
  /** Contradicciones que llevaron a FLAGGED. */
  contradictions: string[];
  /** Pasos que se ejecutaron, en orden (§18). */
  pipeline: string[];
  /** La IA es opcional y nunca decide el nivel (§18.6). */
  aiUsed: boolean;
  checkedAt: string;
}

/** Lo que se pudo averiguar del enlace de verificacion (§31). */
export interface LinkCheckResult {
  status: LinkCheckStatus;
  finalUrl: string | null;
  httpStatus: number | null;
  title: string | null;
  /** Motivo por el que se rechazo consultarlo, cuando esta BLOCKED. */
  blockedReason: string | null;
  checkedAt: string;
}

/**
 * Trabajo y veredicto del Motor de Validación (§73.5, §76).
 *
 * Una fila por recurso validable. Es a la vez la cola de trabajo y el
 * resultado: persistir el trabajo es lo que permite que un reinicio de la API
 * no pierda nada (§76).
 *
 * El polimorfismo (`resource_type` + `resource_id`) impide una clave foranea
 * real. §73.5 lo contempla y da la alternativa de separar en tablas; se
 * mantiene unificada porque el ciclo de vida, los reintentos y el veredicto son
 * identicos para los tres tipos, y separarlas triplicaria el worker. La
 * integridad se cuida en el unico punto donde importa: al escribir el
 * veredicto se comprueba que el recurso siga existiendo.
 */
@Entity('validation_records')
@Index('IDX_validation_records_recurso', ['resourceType', 'resourceId'], { unique: true })
@Index('IDX_validation_records_cola', ['status', 'nextAttemptAt'])
export class ValidationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resource_type', type: 'enum', enum: ValidationResourceType })
  resourceType: ValidationResourceType;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @Column({ type: 'enum', enum: ValidationStatus, default: ValidationStatus.PENDING })
  status: ValidationStatus;

  @Column({
    name: 'backing_tier',
    type: 'enum',
    enum: BackingTier,
    default: BackingTier.DECLARED,
  })
  backingTier: BackingTier;

  @Column({ name: 'extracted_data', type: 'jsonb', nullable: true })
  extractedData: ExtractedDocumentData | null;

  @Column({
    name: 'identity_match_status',
    type: 'enum',
    enum: IdentityMatchStatus,
    default: IdentityMatchStatus.UNKNOWN,
  })
  identityMatchStatus: IdentityMatchStatus;

  @Column({ name: 'link_check', type: 'jsonb', nullable: true })
  linkCheck: LinkCheckResult | null;

  /**
   * Archivo del que este veredicto ya existe, si el contenido esta repetido
   * (§28). Cuando apunta a algo, el respaldo no vuelve a contarse.
   */
  @Column({ name: 'duplicate_of_id', type: 'uuid', nullable: true })
  duplicateOfId: string | null;

  /** V3 §18: verificación oficial de una credencial externa. */
  @Column({ name: 'credential_check', type: 'jsonb', nullable: true })
  credentialCheck: CredentialCheckResult | null;

  // ------------------------------------------- revisión manual excepcional

  /** V3 §16/§19: solo históricas sin verificador; la decide Dirección. */
  @Column({
    name: 'manual_review_status', type: 'enum', enum: ManualReviewStatus,
    enumName: 'validation_manual_review_enum', nullable: true,
  })
  manualReviewStatus: ManualReviewStatus | null;

  /** Lo que el estudiante cuenta a Dirección al pedirla. */
  @Column({ name: 'manual_review_note', type: 'varchar', length: 300, nullable: true })
  manualReviewNote: string | null;

  @Column({ name: 'manual_review_requested_at', type: 'timestamptz', nullable: true })
  manualReviewRequestedAt: Date | null;

  @Column({ name: 'manual_reviewer_id', type: 'uuid', nullable: true })
  manualReviewerId: string | null;

  @Column({ name: 'manual_reviewed_at', type: 'timestamptz', nullable: true })
  manualReviewedAt: Date | null;

  /** Cómo lo comprobó quien revisó. Obligatorio al decidir. */
  @Column({ name: 'manual_review_reason', type: 'varchar', length: 500, nullable: true })
  manualReviewReason: string | null;

  /** Version del validador que produjo el veredicto, para poder reprocesar. */
  @Column({ name: 'validator_version', type: 'smallint', default: 1 })
  validatorVersion: number;

  // ------------------------------------------------------------------ cola

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  /**
   * Cuando puede volver a intentarse.
   *
   * Un trabajo recien creado lo tiene en el pasado, de modo que se toma de
   * inmediato. Tras un fallo se empuja hacia adelante con retroceso acotado
   * (§76): reintentar sin pausa contra un servidor caido no lo levanta.
   */
  @Column({ name: 'next_attempt_at', type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  /**
   * Quien tiene el trabajo reclamado.
   *
   * Reclamar es un `UPDATE ... WHERE status = 'pending'` condicional: si dos
   * procesos lo intentan a la vez, solo uno ve filas afectadas. Esto es lo que
   * evita el procesamiento doble que exige §76 sin necesidad de Redis.
   */
  @Column({ name: 'claimed_by', type: 'varchar', length: 80, nullable: true })
  claimedBy: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_detail', type: 'varchar', length: 400, nullable: true })
  errorDetail: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
