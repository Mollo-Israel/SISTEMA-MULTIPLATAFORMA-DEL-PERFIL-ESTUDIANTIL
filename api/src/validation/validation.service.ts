import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  BackingTier,
  CredentialCheckStatus,
  ExternalCredentialSource,
  IdentityMatchStatus,
  LinkCheckStatus,
  ManualReviewStatus,
  ValidationResourceType,
  ValidationStatus,
} from '@perfil/shared';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import { credentialPatternToRegExp } from '../activities/credential-pattern';
import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import { CredentialVerifierService } from './credential-verifier.service';
import {
  CredentialContradiction,
  MANUAL_REVIEW_CHECKS,
  decideCredentialBacking,
  phraseFound,
} from './credential-check.rules';
import { MIN_USEFUL_TEXT } from './pdf-text';
import { ValidationRecord } from '../entities/validation-record.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { STORAGE_PORT, StoragePort } from '../storage/storage.port';
import { DocumentExtractionService } from './document-extraction.service';
import { LinkCheckerService } from './link-checker.service';
import { compareHolderName } from './metadata.extractor';
import {
  TRAJECTORY_RECALCULATION,
  TrajectoryRecalculationPort,
} from '../trajectory/trajectory-recalculation.port';

/**
 * Version del validador. Subirla permite reprocesar lo ya validado
 * (`POST /validation/reprocess-outdated`).
 *
 * 2 — V3 §18–§20: validación escalonada de credenciales, FLAGGED y
 *     CORROBORATED solo con señal verificable fuerte.
 */
export const VALIDATOR_VERSION = 2;

/** Tope de reintentos antes de darlo por fallido (§76). */
const MAX_ATTEMPTS = 3;

/** Retroceso por intento, en segundos. Acotado: no crece sin límite. */
const BACKOFF_SECONDS = [30, 120, 600];

export interface EnqueueInput {
  resourceType: ValidationResourceType;
  resourceId: string;
  /** Fuerza reprocesar aunque ya exista veredicto. */
  force?: boolean;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    @InjectRepository(ValidationRecord) private readonly records: Repository<ValidationRecord>,
    @InjectRepository(StoredFileRecord) private readonly files: Repository<StoredFileRecord>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly extraction: DocumentExtractionService,
    private readonly linkChecker: LinkCheckerService,
    private readonly audit: AuditService,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
    @InjectRepository(ExternalOpportunityValidationReference)
    private readonly references: Repository<ExternalOpportunityValidationReference>,
    private readonly verifier: CredentialVerifierService,
    @Inject(NOTIFICATION_EMITTER) private readonly notifications: NotificationEmitter,
  ) {}

  // ====================================================================
  //  Cola
  // ====================================================================

  /**
   * Encola un recurso para validar (§76).
   *
   * Es idempotente: encolar dos veces el mismo recurso no crea dos trabajos.
   * Si ya hay veredicto y no se fuerza, no se vuelve a procesar.
   */
  async enqueue({ resourceType, resourceId, force = false }: EnqueueInput): Promise<ValidationRecord> {
    const existente = await this.records.findOne({ where: { resourceType, resourceId } });

    if (existente) {
      const terminado = existente.status === ValidationStatus.COMPLETED
        || existente.status === ValidationStatus.INCONCLUSIVE;
      if (!force && terminado) return existente;
      if (existente.status === ValidationStatus.PROCESSING && !force) return existente;

      existente.status = ValidationStatus.PENDING;
      existente.attempts = 0;
      existente.nextAttemptAt = new Date();
      existente.claimedBy = null;
      existente.errorCode = null;
      existente.errorDetail = null;
      // V3 §19: lo declarado cambió, así que una revisión manual anterior ya
      // no describe esta credencial. Si hace falta, se vuelve a pedir.
      if (force) {
        existente.manualReviewStatus = null;
        existente.manualReviewNote = null;
        existente.manualReviewRequestedAt = null;
        existente.manualReviewerId = null;
        existente.manualReviewedAt = null;
        existente.manualReviewReason = null;
      }
      return this.records.save(existente);
    }

    return this.records.save(
      this.records.create({
        resourceType,
        resourceId,
        status: ValidationStatus.PENDING,
        backingTier: BackingTier.DECLARED,
        validatorVersion: VALIDATOR_VERSION,
        nextAttemptAt: new Date(),
      }),
    );
  }

  /**
   * Reclama un trabajo pendiente para este worker (§76).
   *
   * El `UPDATE ... WHERE status = 'pending'` es lo que impide el procesamiento
   * doble: si dos procesos intentan reclamar la misma fila, la base decide, y
   * solo uno ve filas afectadas. No hace falta Redis ni un bloqueo externo.
   */
  async claimNext(workerId: string): Promise<ValidationRecord | null> {
    const candidato = await this.records.findOne({
      where: {
        status: ValidationStatus.PENDING,
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
      order: { nextAttemptAt: 'ASC', createdAt: 'ASC' },
    });
    if (!candidato) return null;

    const resultado = await this.records
      .createQueryBuilder()
      .update(ValidationRecord)
      .set({
        status: ValidationStatus.PROCESSING,
        claimedBy: workerId,
        startedAt: () => 'now()',
        attempts: () => 'attempts + 1',
      })
      .where('id = :id AND status = :pendiente', {
        id: candidato.id,
        pendiente: ValidationStatus.PENDING,
      })
      .execute();

    // Cero filas: otro worker se adelanto. No es un error, se reintenta en la
    // siguiente vuelta.
    if (!resultado.affected) return null;
    return this.records.findOne({ where: { id: candidato.id } });
  }

  /**
   * Recupera trabajos que quedaron a medias (§76).
   *
   * Si la API se reinicia mientras un worker procesaba, la fila queda en
   * `PROCESSING` sin nadie detrás. Persistir el trabajo solo sirve si algo lo
   * rescata: esto es ese algo.
   */
  async recoverStale(olderThanMs: number): Promise<number> {
    const limite = new Date(Date.now() - olderThanMs);
    const resultado = await this.records
      .createQueryBuilder()
      .update(ValidationRecord)
      .set({ status: ValidationStatus.PENDING, claimedBy: null })
      .where('status = :procesando AND started_at < :limite', {
        procesando: ValidationStatus.PROCESSING,
        limite,
      })
      .execute();
    const recuperados = resultado.affected ?? 0;
    if (recuperados > 0) {
      this.logger.warn(`Se devolvieron a la cola ${recuperados} validación(es) huérfana(s).`);
    }
    return recuperados;
  }

  // ====================================================================
  //  Procesamiento
  // ====================================================================

  /** Procesa un trabajo reclamado y escribe su veredicto. */
  async process(record: ValidationRecord): Promise<ValidationRecord> {
    try {
      const contexto = await this.loadContext(record);
      if (!contexto) {
        // El recurso desaparecio mientras estaba en cola. No es un fallo: ya
        // no hay nada que validar.
        return this.finish(record, {
          status: ValidationStatus.INCONCLUSIVE,
          errorCode: 'RESOURCE_GONE',
          errorDetail: 'El recurso ya no existe.',
        });
      }

      return await this.evaluate(record, contexto);
    } catch (error) {
      return this.fail(record, error);
    }
  }

  /**
   * Decide el nivel de respaldo (§30).
   *
   *   DECLARED     — hay algo aportado, pero nada pudo corroborarse.
   *   SUPPORTED    — el documento se leyó y su metadata es coherente.
   *   CORROBORATED — además, una URL o un QR externo respondió y encaja.
   *
   * Un nombre que no corresponde impide subir de DECLARED por mucho que el
   * documento se lea perfectamente: si el papel es de otra persona, lo demás
   * da igual.
   */
  private async evaluate(record: ValidationRecord, ctx: ValidationContext): Promise<ValidationRecord> {
    if (ctx.credential) return this.evaluateCredential(record, ctx, ctx.credential);
    let extracted = null as ValidationRecord['extractedData'];
    let identity = IdentityMatchStatus.UNKNOWN;
    let duplicateOfId: string | null = null;

    if (ctx.file) {
      // §28: el mismo contenido del mismo dueño ya validado no se revalida ni
      // vuelve a contar como respaldo independiente.
      duplicateOfId = await this.findDuplicate(ctx.file);
      extracted = await this.extraction.extract(ctx.file.buffer, ctx.file.mimeType);
      identity = compareHolderName(ctx.holderName, extracted.holderName);
    }

    const urlACcomprobar = ctx.declaredUrl
      ?? extracted?.verificationUrl
      ?? null;
    const linkCheck = urlACcomprobar ? await this.linkChecker.check(urlACcomprobar) : null;

    const documentoLegible = !!extracted && extracted.textLength >= 40;
    const metadataCoherente = documentoLegible
      && identity !== IdentityMatchStatus.MISMATCH
      && this.metadataEncaja(extracted!, ctx);

    let tier = BackingTier.DECLARED;
    if (metadataCoherente) tier = BackingTier.SUPPORTED;
    if (
      linkCheck?.status === LinkCheckStatus.AVAILABLE
      && identity !== IdentityMatchStatus.MISMATCH
      && (metadataCoherente || !ctx.file)
    ) {
      tier = BackingTier.CORROBORATED;
    }

    // Un duplicado conserva su veredicto, pero no aporta respaldo nuevo: lo
    // que respalda ya lo respaldaba el original (§28).
    const status = documentoLegible || linkCheck
      ? ValidationStatus.COMPLETED
      : ValidationStatus.INCONCLUSIVE;

    const guardado = await this.finish(record, {
      status,
      backingTier: tier,
      extractedData: extracted,
      identityMatchStatus: identity,
      linkCheck,
      duplicateOfId,
      errorCode: status === ValidationStatus.INCONCLUSIVE ? 'NO_READABLE_CONTENT' : null,
      errorDetail:
        status === ValidationStatus.INCONCLUSIVE
          ? 'No se pudo leer texto suficiente ni comprobar un enlace. El recurso se conserva.'
          : null,
    });

    await this.audit.record({
      actorUserId: null,
      eventType: AuditEventType.VALIDATION_COMPLETED,
      entityType: record.resourceType,
      entityId: record.resourceId,
      metadata: {
        status,
        backingTier: tier,
        identityMatchStatus: identity,
        linkStatus: linkCheck?.status ?? null,
        source: extracted?.source ?? null,
        duplicate: !!duplicateOfId,
      },
    });

    return guardado;
  }

  /**
   * ¿Lo que dice el papel encaja con lo que declaró el estudiante?
   *
   * Se es deliberadamente tolerante: basta que **algo** comprobable coincida.
   * Exigir que coincida todo dejaría en DECLARED a certificados legítimos cuyo
   * emisor se escribe distinto, y el objetivo es medir corroboración, no
   * castigar la ortografía.
   */
  private metadataEncaja(extracted: NonNullable<ValidationRecord['extractedData']>, ctx: ValidationContext): boolean {
    const señales: boolean[] = [];

    if (ctx.declaredIssuer && extracted.issuer) {
      señales.push(this.parecido(ctx.declaredIssuer, extracted.issuer));
    }
    if (ctx.declaredTitle && extracted.certificateTitle) {
      señales.push(this.parecido(ctx.declaredTitle, extracted.certificateTitle));
    }
    if (ctx.declaredDate && extracted.issueDate) {
      señales.push(ctx.declaredDate.slice(0, 10) === extracted.issueDate.slice(0, 10));
    }

    // Sin nada que comparar, el nombre del titular decide: si coincide, el
    // documento es de quien dice ser y eso ya es coherencia suficiente.
    if (señales.length === 0) {
      return (
        extracted.holderName !== null
        && compareHolderName(ctx.holderName, extracted.holderName) !== IdentityMatchStatus.MISMATCH
      );
    }
    return señales.some(Boolean);
  }

  private parecido(a: string, b: string): boolean {
    const norm = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const x = norm(a);
    const y = norm(b);
    if (!x || !y) return false;
    if (x.includes(y) || y.includes(x)) return true;
    const palabrasX = new Set(x.split(' ').filter((t) => t.length >= 4));
    const palabrasY = x === y ? palabrasX : new Set(y.split(' ').filter((t) => t.length >= 4));
    return [...palabrasX].some((t) => palabrasY.has(t));
  }

  // ====================================================================
  //  V3 §18–§20 · Credenciales externas: validación escalonada
  // ====================================================================

  /**
   * PDF nativo → QR/URL → OCR → comparación → IA opcional → respaldo determinista.
   *
   * La extracción ya respeta ese orden (texto nativo, QR, OCR). Aquí se
   * consulta la fuente oficial, se buscan contradicciones y se decide el
   * nivel con reglas puras (`credential-check.rules.ts`). La IA no
   * interviene: es opcional y nunca puede marcar CORROBORATED (§18.6).
   */
  private async evaluateCredential(
    record: ValidationRecord,
    ctx: ValidationContext,
    cred: CredentialContext,
  ): Promise<ValidationRecord> {
    const pipeline: string[] = [];
    let extracted = null as ValidationRecord['extractedData'];
    let texto = '';
    let bakedBadge: { json: unknown | null; url: string | null } | null = null;
    let identity = IdentityMatchStatus.UNKNOWN;
    let duplicateOfId: string | null = null;

    if (ctx.file) {
      duplicateOfId = await this.findDuplicate(ctx.file);
      const completo = await this.extraction.extractFull(ctx.file.buffer, ctx.file.mimeType);
      extracted = completo.data;
      texto = completo.text;
      bakedBadge = completo.bakedBadge;
      identity = compareHolderName(ctx.holderName, extracted.holderName);
      pipeline.push(extracted.source === 'none' ? 'document:unreadable' : `document:${extracted.source}`);
    } else {
      pipeline.push('document:none');
    }

    const verificacion = await this.verifier.verify({
      declaredUrl: ctx.declaredUrl,
      qrPayloads: extracted?.qrPayloads ?? [],
      documentUrl: extracted?.verificationUrl ?? null,
      bakedBadge,
      issuer: ctx.declaredIssuer,
      expectedDomains: cred.opportunity?.expectedDomains ?? [],
      holderName: ctx.holderName,
      emails: cred.emails,
      credentialId: cred.declaredCredentialId ?? extracted?.credentialId ?? null,
      course: cred.opportunity?.expectedCourseName ?? ctx.declaredTitle,
    });
    const check = verificacion.check;
    pipeline.push(`qr:${check.qr}`);
    if (check.url) pipeline.push(`verification:${check.urlSource}`);
    if (check.openBadge) pipeline.push(`open_badge:${check.openBadge.format}`);
    pipeline.push('comparison', 'ai:not_used', 'backing:deterministic');

    const legible = texto.length >= MIN_USEFUL_TEXT;
    const contradicciones = this.contradicciones(ctx, cred, extracted, texto, identity, check.status);
    const metadataCoherente = legible && identity !== IdentityMatchStatus.MISMATCH && this.metadataEncaja(extracted!, ctx);
    const contextoOportunidad = !!cred.opportunity && legible && identity !== IdentityMatchStatus.MISMATCH
      && this.encajaConOportunidad(texto, cred.opportunity);

    let tier = decideCredentialBacking({
      identity,
      check: check.status,
      metadataCoherent: metadataCoherente,
      opportunityContextMatch: contextoOportunidad,
      officialReachable: verificacion.link?.status === LinkCheckStatus.AVAILABLE && check.official === true,
      contradictions: contradicciones,
    });
    // §16: la revisión manual excepcional se respeta mientras nada la
    // contradiga; si aparece una contradicción, manda la contradicción.
    if (record.manualReviewStatus === ManualReviewStatus.CORROBORATED && tier !== BackingTier.FLAGGED) {
      tier = BackingTier.CORROBORATED;
    }

    // §18.2: un proveedor caído o un verificador apagado no permiten concluir,
    // pero eso no es un fallo ni hace falsa la credencial.
    const sinConclusion = !legible && [
      CredentialCheckStatus.UNREACHABLE, CredentialCheckStatus.INCONCLUSIVE, CredentialCheckStatus.NO_VERIFIER,
    ].includes(check.status) && !check.openBadge;
    const status = sinConclusion ? ValidationStatus.INCONCLUSIVE : ValidationStatus.COMPLETED;

    const guardado = await this.finish(record, {
      status,
      backingTier: tier,
      extractedData: extracted,
      identityMatchStatus: identity,
      linkCheck: verificacion.link,
      duplicateOfId,
      credentialCheck: { ...check, contradictions: contradicciones, pipeline, aiUsed: false },
      errorCode: sinConclusion ? 'NO_CONCLUSIVE_SIGNAL' : null,
      errorDetail: sinConclusion
        ? 'No se pudo leer el documento ni comprobar una fuente oficial. La credencial se conserva.'
        : null,
    });

    await this.audit.record({
      actorUserId: null,
      eventType: AuditEventType.EXTERNAL_CREDENTIAL_CHECKED,
      entityType: record.resourceType,
      entityId: record.resourceId,
      metadata: {
        status,
        backingTier: tier,
        credentialCheck: check.status,
        official: check.official,
        qr: check.qr,
        contradictions: contradicciones,
        identityMatchStatus: identity,
        duplicate: !!duplicateOfId,
      },
    });

    if (tier === BackingTier.FLAGGED) {
      try {
        await this.notifications.emit({
          userId: cred.ownerUserId,
          kind: 'EXTERNAL_CREDENTIAL_FLAGGED',
          title: 'Revisa una credencial',
          body: 'Algo no coincide en una credencial que registraste. No se borró: corrige los datos o el archivo.',
          link: '/student/evidences',
          dedupeKey: `credential-flagged:${record.resourceId}:${guardado.finishedAt?.toISOString() ?? ''}`,
        });
      } catch {
        // La notificación nunca deshace el veredicto.
      }
    }
    return guardado;
  }

  /** Contradicciones significativas (§19 FLAGGED). Solo con datos legibles: sin texto no se acusa a nadie. */
  private contradicciones(
    ctx: ValidationContext,
    cred: CredentialContext,
    extracted: ValidationRecord['extractedData'],
    texto: string,
    identity: IdentityMatchStatus,
    check: CredentialCheckStatus,
  ): CredentialContradiction[] {
    const out: CredentialContradiction[] = [];
    if (identity === IdentityMatchStatus.MISMATCH) out.push('holder_mismatch');
    if (check === CredentialCheckStatus.MISMATCH) out.push('verification_mismatch');

    const limpiar = (x: string) => x.replace(/[\s-]+/g, '').toLowerCase();
    const declarado = cred.declaredCredentialId;
    const leido = extracted?.credentialId ?? null;
    if (declarado && leido && limpiar(declarado) !== limpiar(leido)) out.push('credential_id_mismatch');

    const patron = cred.opportunity?.credentialIdPattern;
    if (patron) {
      const re = credentialPatternToRegExp(patron);
      const codigos = [declarado, leido].filter((c): c is string => !!c);
      if (codigos.some((c) => !re.test(c.trim()))) out.push('credential_id_pattern');
    }

    const op = cred.opportunity;
    if (op && texto.length >= MIN_USEFUL_TEXT) {
      const esperado = [op.expectedCourseName, ...op.expectedKeywords].filter((x): x is string => !!x);
      if (esperado.length && !esperado.some((k) => phraseFound(texto, k))) out.push('course_mismatch');
      const dominioEnTexto = op.expectedDomains.some((d) => texto.toLowerCase().includes(d.toLowerCase()));
      if (op.provider && !phraseFound(texto, op.provider, 0.5) && !dominioEnTexto) out.push('issuer_mismatch');
    }
    void ctx;
    return out;
  }

  /** §19 SUPPORTED: el documento coincide con lo que se esperaba de la oportunidad. */
  private encajaConOportunidad(texto: string, op: NonNullable<CredentialContext['opportunity']>): boolean {
    const esperado = [op.expectedCourseName, ...op.expectedKeywords].filter((x): x is string => !!x);
    const curso = esperado.length > 0 && esperado.some((k) => phraseFound(texto, k));
    const proveedor = !!op.provider && phraseFound(texto, op.provider, 0.5);
    return curso && proveedor;
  }

  // ====================================================================
  //  V3 §16 · Revisión manual excepcional
  // ====================================================================

  /** ¿Puede pedirse? Histórica, ya comprobada, sin verificador que concluya, sin contradicciones. */
  canRequestManualReview(record: ValidationRecord, cert: Pick<ExternalCertificate, 'source' | 'storedFileId' | 'certificateUrl'>): boolean {
    return cert.source === ExternalCredentialSource.HISTORICAL_EXTERNAL
      && (record.status === ValidationStatus.COMPLETED || record.status === ValidationStatus.INCONCLUSIVE)
      && record.validatorVersion >= VALIDATOR_VERSION
      && !!record.credentialCheck
      && MANUAL_REVIEW_CHECKS.includes(record.credentialCheck.status)
      && record.backingTier !== BackingTier.CORROBORATED
      && record.backingTier !== BackingTier.FLAGGED
      && record.manualReviewStatus === null
      && !!(cert.storedFileId || cert.certificateUrl);
  }

  async requestManualReview(
    ownerUserId: string,
    cert: ExternalCertificate,
    note: string | null,
  ): Promise<ValidationRecord> {
    const record = await this.findForOrFail(ValidationResourceType.EXTERNAL_CERTIFICATE, cert.id);
    if (record.manualReviewStatus === ManualReviewStatus.REQUESTED) {
      throw new ConflictException({ code: 'MANUAL_REVIEW_ALREADY_REQUESTED', message: 'Ya pediste la revisión de esta credencial.' });
    }
    if (!this.canRequestManualReview(record, cert)) {
      const m = cert.source !== ExternalCredentialSource.HISTORICAL_EXTERNAL
        ? 'La revisión excepcional es solo para credenciales históricas: las de una oportunidad se validan con su referencia.'
        : 'Esta credencial no necesita revisión excepcional: ya se comprobó con una fuente oficial, tiene datos que corregir o falta el archivo.';
      throw new BadRequestException({ code: 'MANUAL_REVIEW_NOT_AVAILABLE', message: m });
    }
    record.manualReviewStatus = ManualReviewStatus.REQUESTED;
    record.manualReviewNote = note?.trim() ? note.trim().slice(0, 300) : null;
    record.manualReviewRequestedAt = new Date();
    const guardado = await this.records.save(record);
    await this.audit.record({
      actorUserId: ownerUserId,
      eventType: AuditEventType.EXTERNAL_CREDENTIAL_MANUAL_REVIEW_REQUESTED,
      entityType: ValidationResourceType.EXTERNAL_CERTIFICATE,
      entityId: cert.id,
      metadata: { credentialCheck: record.credentialCheck?.status ?? null },
    });
    return guardado;
  }

  /** Pendientes de revisión, para Dirección. */
  async pendingManualReviews() {
    const filas = await this.records
      .createQueryBuilder('v')
      .innerJoin(ExternalCertificate, 'c', 'c.id = v.resource_id')
      .innerJoin(StudentProfile, 'p', 'p.id = c.student_profile_id')
      .innerJoin('p.user', 'u')
      .select([
        'c.id AS "certificateId"', 'c.certificate_name AS "certificateName"', 'c.issuer AS issuer',
        'c.issue_date AS "issueDate"', 'c.credential_id AS "credentialId"', 'c.certificate_url AS "certificateUrl"',
        'c.file_url AS "fileUrl"', 'p.semester AS semester',
        `u.first_name || ' ' || u.last_name AS "studentName"`,
        `v.credential_check ->> 'status' AS "credentialCheck"`,
        'v.manual_review_note AS "requestNote"', 'v.manual_review_requested_at AS "requestedAt"',
      ])
      .where('v.resource_type = :t', { t: ValidationResourceType.EXTERNAL_CERTIFICATE })
      .andWhere('v.manual_review_status = :r', { r: ManualReviewStatus.REQUESTED })
      .orderBy('v.manual_review_requested_at', 'ASC')
      .limit(200)
      .getRawMany();
    return filas;
  }

  async decideManualReview(
    reviewerUserId: string,
    certificateId: string,
    decision: ManualReviewStatus.CORROBORATED | ManualReviewStatus.NOT_CORROBORATED,
    reason: string,
  ): Promise<ValidationRecord> {
    const record = await this.findForOrFail(ValidationResourceType.EXTERNAL_CERTIFICATE, certificateId);
    if (record.manualReviewStatus !== ManualReviewStatus.REQUESTED) {
      throw new ConflictException({ code: 'MANUAL_REVIEW_NOT_REQUESTED', message: 'Esta credencial no tiene una revisión pendiente.' });
    }
    const cert = await this.certificates.findOne({
      where: { id: certificateId },
      relations: { studentProfile: true },
    });
    if (!cert) throw new NotFoundException('Credencial no encontrada.');

    record.manualReviewStatus = decision;
    record.manualReviewerId = reviewerUserId;
    record.manualReviewedAt = new Date();
    record.manualReviewReason = reason.trim().slice(0, 500);
    if (decision === ManualReviewStatus.CORROBORATED) record.backingTier = BackingTier.CORROBORATED;
    const guardado = await this.records.save(record);

    await this.audit.record({
      actorUserId: reviewerUserId,
      eventType: AuditEventType.EXTERNAL_CREDENTIAL_MANUAL_REVIEWED,
      entityType: ValidationResourceType.EXTERNAL_CERTIFICATE,
      entityId: certificateId,
      metadata: { decision, reason: record.manualReviewReason, backingTier: guardado.backingTier },
    });
    await this.trajectory.requestRecalculation(cert.studentProfileId);
    try {
      await this.notifications.emit({
        userId: cert.studentProfile.userId,
        kind: 'EXTERNAL_CREDENTIAL_MANUAL_REVIEWED',
        title: decision === ManualReviewStatus.CORROBORATED ? 'Credencial corroborada' : 'Revisión de credencial',
        body: decision === ManualReviewStatus.CORROBORATED
          ? `Dirección corroboró «${cert.certificateName}».`
          : `Dirección no pudo corroborar «${cert.certificateName}». Conserva su nivel actual.`,
        link: '/student/evidences',
        dedupeKey: `credential-manual-review:${certificateId}:${decision}`,
      });
    } catch {
      // La notificación nunca deshace la decisión.
    }
    return guardado;
  }

  /**
   * Vuelve a encolar lo validado con una versión anterior del validador.
   *
   * No borra nada ni reinicia revisiones manuales: solo pide que se
   * recalcule con las reglas vigentes.
   */
  async reprocessOutdated(limit: number): Promise<{ encolados: number; pendientes: number }> {
    const viejos = await this.records.find({
      where: { validatorVersion: LessThan(VALIDATOR_VERSION), status: Not(ValidationStatus.PROCESSING) },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    for (const r of viejos) {
      r.status = ValidationStatus.PENDING;
      r.attempts = 0;
      r.nextAttemptAt = new Date();
      r.claimedBy = null;
    }
    if (viejos.length) await this.records.save(viejos);
    const pendientes = await this.records.count({ where: { validatorVersion: LessThan(VALIDATOR_VERSION) } });
    return { encolados: viejos.length, pendientes };
  }

  /**
   * Archivo **anterior** del mismo dueño con el mismo contenido (§28).
   *
   * Solo cuenta lo subido antes. El primero de dos archivos idénticos no es
   * duplicado de su propia copia: si lo fuera, el original dejaría de
   * respaldar nada por el mero hecho de que alguien lo volviera a subir.
   */
  private async findDuplicate(file: LoadedFile): Promise<string | null> {
    const propio = await this.files.findOne({ where: { id: file.storedFileId } });
    if (!propio) return null;

    const anterior = await this.files.findOne({
      where: {
        sha256: file.sha256,
        uploadedByUserId: file.uploadedByUserId,
        createdAt: LessThan(propio.createdAt),
      },
      order: { createdAt: 'ASC' },
    });
    return anterior?.id ?? null;
  }

  // ====================================================================
  //  Escritura del veredicto
  // ====================================================================

  private async finish(
    record: ValidationRecord,
    cambios: Partial<ValidationRecord>,
  ): Promise<ValidationRecord> {
    Object.assign(record, cambios, {
      finishedAt: new Date(),
      claimedBy: null,
      validatorVersion: VALIDATOR_VERSION,
    });
    const guardado = await this.records.save(record);
    await this.recalcularDueno(guardado);
    return guardado;
  }

  /**
   * Avisa al Motor de Afinidad de que hay un veredicto nuevo (§57).
   *
   * §51.4 puntua un certificado **segun lo que se pudo corroborar**, y §53
   * hace lo mismo con el respaldo. Hasta ahora el veredicto se guardaba y ahi
   * se quedaba: un certificado pasaba a CORROBORATED y el puntaje del
   * estudiante seguia siendo el del nivel anterior hasta que tocara cualquier
   * otra cosa. §57 lo nombra entre las senales que obligan a recalcular.
   *
   * Recalcula al dueno del recurso, no a quien disparo la validacion: son
   * personas distintas cuando un docente pide reprocesar (§57, «al propietario
   * correcto de la senal»).
   */
  private async recalcularDueno(record: ValidationRecord): Promise<void> {
    const terminal = record.status === ValidationStatus.COMPLETED
      || record.status === ValidationStatus.INCONCLUSIVE
      || record.status === ValidationStatus.FAILED;
    if (!terminal) return;

    try {
      const dueno = await this.duenoDe(record);
      if (dueno) await this.trajectory.requestRecalculation(dueno);
    } catch (e) {
      // El veredicto ya esta guardado y es lo que importa. Un fallo al
      // recalcular no puede deshacerlo ni volver a encolar el trabajo.
      this.logger.warn(
        `Veredicto ${record.resourceType}/${record.resourceId} guardado, `
        + `pero la afinidad no pudo recalcularse: ${String(e)}`,
      );
    }
  }

  /** Perfil estudiantil al que pertenece el recurso validado. */
  private async duenoDe(record: ValidationRecord): Promise<string | null> {
    if (record.resourceType === ValidationResourceType.EXTERNAL_CERTIFICATE) {
      const cert = await this.certificates.findOne({
        where: { id: record.resourceId },
        select: { id: true, studentProfileId: true },
      });
      return cert?.studentProfileId ?? null;
    }
    const evidencia = await this.evidences.findOne({
      where: { id: record.resourceId },
      select: { id: true, studentProfileId: true },
    });
    return evidencia?.studentProfileId ?? null;
  }

  /**
   * Registra el fallo y decide si se reintenta (§76).
   *
   * Con intentos disponibles vuelve a PENDING con retroceso; agotados, queda
   * FAILED. En ningún caso se toca el recurso: un error del validador no puede
   * borrar la evidencia de nadie.
   */
  private async fail(record: ValidationRecord, error: unknown): Promise<ValidationRecord> {
    const detalle = String(error instanceof Error ? error.message : error).slice(0, 400);
    this.logger.warn(
      `Validación ${record.resourceType}/${record.resourceId} falló `
      + `(intento ${record.attempts}): ${detalle}`,
    );

    if (record.attempts < MAX_ATTEMPTS) {
      const espera = BACKOFF_SECONDS[Math.min(record.attempts - 1, BACKOFF_SECONDS.length - 1)];
      record.status = ValidationStatus.PENDING;
      record.claimedBy = null;
      record.nextAttemptAt = new Date(Date.now() + espera * 1000);
      record.errorCode = 'RETRY';
      record.errorDetail = detalle;
      return this.records.save(record);
    }

    return this.finish(record, {
      status: ValidationStatus.FAILED,
      errorCode: 'MAX_ATTEMPTS',
      errorDetail: detalle,
    });
  }

  // ====================================================================
  //  Contexto del recurso
  // ====================================================================

  private async loadContext(record: ValidationRecord): Promise<ValidationContext | null> {
    if (record.resourceType === ValidationResourceType.EXTERNAL_CERTIFICATE) {
      const cert = await this.certificates.findOne({
        where: { id: record.resourceId },
        relations: { studentProfile: { user: true }, activity: true },
      });
      if (!cert) return null;
      const ref = cert.activityId
        ? await this.references.findOne({ where: { activityId: cert.activityId } })
        : null;
      const a = cert.activity;
      return {
        holderName: this.nombreDe(cert.studentProfile),
        declaredIssuer: cert.issuer,
        declaredTitle: cert.certificateName,
        declaredDate: cert.issueDate,
        declaredUrl: cert.certificateUrl,
        studentProfileId: cert.studentProfileId,
        file: await this.loadFile(cert.storedFileId),
        credential: {
          ownerUserId: cert.studentProfile.userId,
          emails: cert.studentProfile.user?.email ? [cert.studentProfile.user.email] : [],
          declaredCredentialId: cert.credentialId,
          opportunity: a
            ? {
              provider: a.provider,
              expectedDomains: a.expectedIssuerDomains ?? [],
              expectedKeywords: a.expectedKeywords ?? [],
              expectedCourseName: ref?.expectedCourseName ?? null,
              credentialIdPattern: ref?.credentialIdPattern ?? null,
            }
            : null,
        },
      };
    }

    const evidencia = await this.evidences.findOne({
      where: { id: record.resourceId },
      relations: { studentProfile: { user: true } },
    });
    if (!evidencia) return null;
    return {
      holderName: this.nombreDe(evidencia.studentProfile),
      declaredIssuer: null,
      declaredTitle: evidencia.description,
      declaredDate: null,
      declaredUrl: evidencia.externalUrl,
      studentProfileId: evidencia.studentProfileId,
      file: await this.loadFile(evidencia.storedFileId),
    };
  }

  private nombreDe(profile: StudentProfile | null | undefined): string {
    const user = profile?.user;
    return user ? `${user.firstName} ${user.lastName}` : '';
  }

  /** Lee el archivo del almacenamiento junto a sus metadatos. */
  private async loadFile(storedFileId: string | null): Promise<LoadedFile | null> {
    if (!storedFileId) return null;
    const registro = await this.files.findOne({ where: { id: storedFileId } });
    if (!registro) return null;

    const buffer = await this.storage.read(registro.storageKey);
    if (!buffer) return null;

    return {
      storedFileId: registro.id,
      buffer,
      mimeType: registro.mimeTypeDetected,
      sha256: registro.sha256,
      uploadedByUserId: registro.uploadedByUserId,
    };
  }

  // ====================================================================
  //  Consulta
  // ====================================================================

  async findFor(
    resourceType: ValidationResourceType,
    resourceId: string,
  ): Promise<ValidationRecord | null> {
    return this.records.findOne({ where: { resourceType, resourceId } });
  }

  async findForOrFail(
    resourceType: ValidationResourceType,
    resourceId: string,
  ): Promise<ValidationRecord> {
    const record = await this.findFor(resourceType, resourceId);
    if (!record) throw new NotFoundException('Este recurso no tiene validación registrada.');
    return record;
  }

  /** Estado de la cola, para diagnóstico del administrador. */
  async queueStats() {
    const filas = await this.records
      .createQueryBuilder('v')
      .select('v.status', 'status')
      .addSelect('COUNT(*)::int', 'total')
      .groupBy('v.status')
      .getRawMany<{ status: ValidationStatus; total: number }>();

    const porEstado = Object.fromEntries(filas.map((f) => [f.status, f.total]));
    const pendientesVencidos = await this.records.count({
      where: {
        status: ValidationStatus.PENDING,
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
    });
    const huerfanos = await this.records.count({
      where: { status: ValidationStatus.PROCESSING, claimedBy: Not(IsNull()) },
    });

    return {
      validatorVersion: VALIDATOR_VERSION,
      byStatus: {
        pending: porEstado[ValidationStatus.PENDING] ?? 0,
        processing: porEstado[ValidationStatus.PROCESSING] ?? 0,
        completed: porEstado[ValidationStatus.COMPLETED] ?? 0,
        inconclusive: porEstado[ValidationStatus.INCONCLUSIVE] ?? 0,
        failed: porEstado[ValidationStatus.FAILED] ?? 0,
      },
      readyNow: pendientesVencidos,
      inFlight: huerfanos,
    };
  }
}

/* ------------------------------------------------------------------ */

interface LoadedFile {
  storedFileId: string;
  buffer: Buffer;
  mimeType: string;
  sha256: string;
  uploadedByUserId: string;
}

/** Lo propio de una credencial externa (V3 §18). */
interface CredentialContext {
  ownerUserId: string;
  /** Correos del estudiante, para comprobar el destinatario de una insignia. */
  emails: string[];
  declaredCredentialId: string | null;
  /** Lo que se esperaba de la oportunidad, si viene de una (§15, §17). */
  opportunity: {
    provider: string | null;
    expectedDomains: string[];
    expectedKeywords: string[];
    expectedCourseName: string | null;
    credentialIdPattern: string | null;
  } | null;
}

interface ValidationContext {
  /** Solo en credenciales externas. */
  credential?: CredentialContext;
  /** Nombre del titular según el sistema, para comparar con el del papel. */
  holderName: string;
  declaredIssuer: string | null;
  declaredTitle: string | null;
  declaredDate: string | null;
  declaredUrl: string | null;
  studentProfileId: string;
  file: LoadedFile | null;
}
