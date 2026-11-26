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
  CREDENTIAL_VALIDATION_LABEL,
  CredentialValidationStatus,
  INDEPENDENT_REVIEW_METHODS,
  ManualReviewMethod,
  ManualReviewStatus,
  ProcessingSkipReason,
  ValidationResourceType,
  ValidationStatus,
} from '@perfil/shared';
import { Activity } from '../entities/activity.entity';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import type { DocumentComparison, PreviousValidationResult } from '../entities/validation-record.entity';
import {
  RutaDeCredencial,
  archivar,
  fotoDelResultado,
  hayResultadoQueArchivar,
  resultadoVigente,
  revisionDecidida,
  rutaDeCredencial,
  tieneEvidenciaMinima,
} from './credential-route.rules';
import { compararConModelo } from './document-comparison.rules';
import { ModeloVigente, modeloVigente } from './reference-model';
import { credentialPatternToRegExp } from '../activities/credential-pattern';
import { NOTIFICATION_EMITTER, NotificationEmitter } from '../notifications/notification.port';
import { CredentialVerifierService } from './credential-verifier.service';
import {
  CredentialContradiction,
  MANUAL_REVIEW_CHECKS,
  decideCredentialBacking,
  phraseFound,
  deriveCredentialValidationStatus,
  officialDomainsFor,
} from './credential-check.rules';
import { qrContradiceCodigo } from './credential-integrity.rules';
import { ForensicsService, firmadoPorElEmisor } from './forensics/forensics.service';
import { CRITICAL_FORENSIC_CODES, ForensicReport, agregarSenal } from './forensics/forensic-report';
import { SharedCredentialResult, SharedCredentialService } from './fraud/shared-credential.service';
import { StudentVerifiedEmail } from '../entities/verified-email.entity';
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
import { quitarBarrasFinales } from '../common/texto';

/**
 * Version del validador. Subirla permite reprocesar lo ya validado
 * (`POST /validation/reprocess-outdated`).
 *
 * 2 — V3 §18–§20: validación escalonada de credenciales, FLAGGED y
 *     CORROBORATED solo con señal verificable fuerte.
 * 3 — V4.1 A41-018: la fuente oficial que nombra a otro titular contradice (B30).
 */
/**
 * V9: análisis forense del archivo, antifraude entre estudiantes, coherencia
 * QR/código, conector de Credly y correos personales comprobados. Subir la
 * versión hace que `reprocess-outdated` vuelva a evaluar lo ya validado.
 */
export const VALIDATOR_VERSION = 4;

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

/** Una verificación manual necesita un método independiente y una prueba externa que no sea la URL del propio certificado. */
function exigirPruebaExterna(method: ManualReviewMethod | null | undefined, prueba: string | null, urlDelCertificado: string | null): void {
  const fields: Record<string, string[]> = {};
  if (!method || !INDEPENDENT_REVIEW_METHODS.includes(method)) {
    fields.method = ['Para verificarla hace falta una prueba externa: consulta al emisor, su confirmación o un registro institucional. Si solo revisaste el documento, márcala como inconclusa.'];
  }
  const mismaUrl = !!prueba && !!urlDelCertificado
    && quitarBarrasFinales(prueba).toLowerCase() === quitarBarrasFinales(urlDelCertificado).toLowerCase();
  if (!prueba || prueba.length < 10) fields.proof = ['Indica la prueba externa: enlace oficial individual o referencia concreta (al menos 10 caracteres).'];
  else if (mismaUrl) fields.proof = ['La prueba debe ser independiente del propio certificado: su misma URL no cuenta.'];
  if (Object.keys(fields).length) {
    throw new BadRequestException({
      code: 'MANUAL_REVIEW_PROOF_REQUIRED',
      message: 'Una verificación manual necesita una prueba externa independiente del archivo.',
      fields,
    });
  }
}

/** El respaldo después de la revisión de Dirección. */
function respaldoTrasRevision(decision: ManualReviewStatus, actual: BackingTier): BackingTier {
  if (decision === ManualReviewStatus.CORROBORATED) return BackingTier.CORROBORATED;
  if (decision === ManualReviewStatus.REJECTED) return BackingTier.FLAGGED;
  if (decision === ManualReviewStatus.INCONCLUSIVE && actual === BackingTier.CORROBORATED) return BackingTier.SUPPORTED;
  return actual;
}

/** El aviso al estudiante según la decisión de Dirección. */
function avisoDeRevision(decision: ManualReviewStatus, nombre: string, motivo: string | null): string {
  if (decision === ManualReviewStatus.CORROBORATED) return `Dirección verificó «${nombre}» con una prueba externa.`;
  if (decision === ManualReviewStatus.REJECTED) return `Dirección rechazó «${nombre}»: ${motivo}`;
  return `Dirección revisó «${nombre}», pero no pudo verificarla con una fuente externa. Queda inconclusa.`;
}

/**
 * §16: la revisión manual excepcional se respeta mientras nada la contradiga; si
 * aparece una contradicción, manda la contradicción. V4.1 A41-018: una revisión
 * inconclusa no sube de SUPPORTED; un rechazo documentado queda señalado.
 */
function ajustarPorRevisionManual(tier: BackingTier, revision: ManualReviewStatus | null | undefined): BackingTier {
  if (revision === ManualReviewStatus.CORROBORATED && tier !== BackingTier.FLAGGED) return BackingTier.CORROBORATED;
  if (revision === ManualReviewStatus.REJECTED) return BackingTier.FLAGGED;
  if (revision === ManualReviewStatus.INCONCLUSIVE && tier === BackingTier.CORROBORATED) return BackingTier.SUPPORTED;
  return tier;
}

/** Columnas de la revisión humana: el worker nunca las escribe (§5.3, C28). */
const CAMPOS_DE_REVISION = [
  'manualReviewStatus', 'manualReviewNote', 'manualReviewRequestedAt', 'manualReviewerId',
  'manualReviewedAt', 'manualReviewReason', 'manualReviewMethod', 'manualReviewProof',
] as const;

/** Lo que produjo una comprobación anterior: no describe un archivo nuevo. */
function limpiarResultado(r: ValidationRecord): void {
  r.extractedData = null;
  r.credentialCheck = null;
  r.linkCheck = null;
  r.identityMatchStatus = IdentityMatchStatus.UNKNOWN;
  r.duplicateOfId = null;
  r.errorCode = null;
  r.errorDetail = null;
  r.attempts = 0;
  r.claimedBy = null;
  r.startedAt = null;
}

function limpiarRevision(r: ValidationRecord): void {
  for (const k of CAMPOS_DE_REVISION) (r as unknown as Record<string, unknown>)[k] = null;
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
    private readonly forensics: ForensicsService,
    private readonly shared: SharedCredentialService,
    @InjectRepository(StudentVerifiedEmail) private readonly verifiedEmails: Repository<StudentVerifiedEmail>,
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
    // V7.1 §5.3: una credencial externa sigue su ruta (histórica o sin modelo:
    // no se procesa) y una comprobación nueva nunca borra la decisión de Dirección.
    if (resourceType === ValidationResourceType.EXTERNAL_CERTIFICATE) {
      return this.recomprobarCredencial(resourceId, { actorUserId: null, explicita: false, force });
    }
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
        existente.manualReviewMethod = null;
        existente.manualReviewProof = null;
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

  // ====================================================================
  //  V7.1 §5.2–§5.3 · Envío de una credencial externa
  // ====================================================================

  /**
   * Decide qué pasa con una credencial al enviarse o corregirse.
   *
   *  - Histórica, o vinculada sin certificado modelo: las fases 1 y 2 no
   *    aplican. No se lee el archivo ni se consulta ninguna fuente.
   *  - Vinculada con modelo: se encola la comprobación (fases 1 y 2).
   *
   * En los tres casos, con la evidencia mínima de D08 (archivo o enlace), la
   * credencial queda pendiente de la revisión de Dirección: el envío no
   * depende de lo que digan las comprobaciones. Lo que había antes
   * (resultados, una decisión) se archiva como intento anterior; no se pisa.
   */
  async encaminarCredencial(
    cert: ExternalCertificate,
    actorUserId: string | null,
    motivo: PreviousValidationResult['reason'] | null,
  ): Promise<ValidationRecord> {
    const modelo = await this.modeloDe(cert);
    const ruta = rutaDeCredencial(cert.source, !!modelo);

    let record = await this.findFor(ValidationResourceType.EXTERNAL_CERTIFICATE, cert.id);
    if (record && hayResultadoQueArchivar(record)) {
      record.previousResults = archivar(record.previousResults, fotoDelResultado(record, motivo ?? 'rerouted'));
    }
    record ??= this.records.create({
      resourceType: ValidationResourceType.EXTERNAL_CERTIFICATE,
      resourceId: cert.id,
      previousResults: [],
    });

    limpiarResultado(record);
    record.fileSha256 = await this.shaDe(cert.storedFileId);
    record.validatorVersion = VALIDATOR_VERSION;
    record.backingTier = BackingTier.DECLARED;
    if (ruta.procesar) {
      record.status = ValidationStatus.PENDING;
      record.skippedReason = null;
      record.referenceVersionId = modelo!.version.id;
      record.nextAttemptAt = new Date();
      record.finishedAt = null;
    } else {
      record.status = ValidationStatus.NOT_APPLICABLE;
      record.skippedReason = ruta.motivo;
      record.referenceVersionId = null;
      record.finishedAt = new Date();
    }

    const pedirRevision = tieneEvidenciaMinima(cert);
    limpiarRevision(record);
    if (pedirRevision) {
      record.manualReviewStatus = ManualReviewStatus.REQUESTED;
      record.manualReviewRequestedAt = new Date();
    }
    const guardado = await this.records.save(record);

    if (pedirRevision) {
      await this.audit.record({
        actorUserId,
        eventType: AuditEventType.EXTERNAL_CREDENTIAL_MANUAL_REVIEW_REQUESTED,
        entityType: ValidationResourceType.EXTERNAL_CERTIFICATE,
        entityId: cert.id,
        metadata: {
          automatico: true,
          ruta: ruta.procesar ? 'comprobacion' : ruta.motivo,
          motivo,
          referenceVersionId: guardado.referenceVersionId,
          fileSha256: guardado.fileSha256,
        },
      });
    }
    return guardado;
  }

  /**
   * Vuelve a comprobar una credencial ya enviada, con su archivo actual
   * («Comprobar información», o Dirección sobre una pendiente).
   *
   *  - Solo se procesan las vinculadas con modelo. Las demás no cambian.
   *  - El resultado vigente se archiva como intento anterior; no se pisa.
   *  - La revisión de Dirección no se toca, y una ya decidida no se vuelve a
   *    comprobar (C28).
   *
   * `explicita` = la pidió una persona: si no corresponde, se le dice por qué.
   * Si la pide el sistema (p. ej., cambió un correo comprobado), se omite sin error.
   */
  async recomprobarCredencial(
    certificateId: string,
    opts: { actorUserId: string | null; explicita: boolean; force?: boolean },
  ): Promise<ValidationRecord> {
    const cert = await this.certificates.findOne({ where: { id: certificateId } });
    if (!cert) throw new NotFoundException('Credencial no encontrada.');
    const record = await this.findFor(ValidationResourceType.EXTERNAL_CERTIFICATE, certificateId);
    if (!record) return this.encaminarCredencial(cert, opts.actorUserId, null);

    const modelo = await this.modeloDe(cert);
    const ruta = rutaDeCredencial(cert.source, !!modelo);
    const noCorresponde = (code: string, message: string): ValidationRecord => {
      if (opts.explicita) throw new ConflictException({ code, message });
      return record;
    };
    if (!ruta.procesar) {
      return noCorresponde('RECHECK_NOT_APPLICABLE', ruta.motivo === ProcessingSkipReason.HISTORICAL
        ? 'Una credencial obtenida fuera de Afinia no se compara automáticamente: la revisa Dirección.'
        : 'La oportunidad no tiene certificado modelo: la credencial la revisa Dirección directamente.');
    }
    if (revisionDecidida(record.manualReviewStatus)) {
      return noCorresponde('RECHECK_AFTER_DECISION', 'Dirección ya decidió esta credencial. Una comprobación nueva no cambia esa decisión.');
    }
    if (record.status === ValidationStatus.PENDING || record.status === ValidationStatus.PROCESSING) {
      return noCorresponde('RECHECK_IN_PROGRESS', 'La comprobación ya está en curso.');
    }
    if (!opts.explicita && !opts.force) return record;
    if (!cert.storedFileId && !cert.certificateUrl) {
      return noCorresponde('RECHECK_NOTHING_TO_CHECK', 'La credencial no tiene archivo ni enlace que comprobar.');
    }

    if (hayResultadoQueArchivar(record)) {
      record.previousResults = archivar(record.previousResults, fotoDelResultado(record, 'rechecked'));
    }
    limpiarResultado(record);
    record.status = ValidationStatus.PENDING;
    record.skippedReason = null;
    record.referenceVersionId = modelo!.version.id;
    record.fileSha256 = await this.shaDe(cert.storedFileId);
    record.nextAttemptAt = new Date();
    record.finishedAt = null;
    const guardado = await this.records.save(record);

    if (opts.explicita) {
      await this.audit.record({
        actorUserId: opts.actorUserId,
        eventType: AuditEventType.EXTERNAL_CREDENTIAL_RECHECK_REQUESTED,
        entityType: ValidationResourceType.EXTERNAL_CERTIFICATE,
        entityId: certificateId,
        metadata: { referenceVersionId: guardado.referenceVersionId, fileSha256: guardado.fileSha256 },
      });
    }
    return guardado;
  }

  /** Modelo vigente de la oportunidad de una vinculada; `null` en las demás. */
  private async modeloDe(cert: Pick<ExternalCertificate, 'source' | 'activityId'>): Promise<ModeloVigente | null> {
    if (cert.source !== ExternalCredentialSource.OPPORTUNITY || !cert.activityId) return null;
    return modeloVigente(this.records.manager, cert.activityId);
  }

  private async shaDe(storedFileId: string | null): Promise<string | null> {
    if (!storedFileId) return null;
    const f = await this.files.findOne({ where: { id: storedFileId }, select: { id: true, sha256: true } });
    return f?.sha256 ?? null;
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
        return (await this.finish(record, {
          status: ValidationStatus.INCONCLUSIVE,
          errorCode: 'RESOURCE_GONE',
          errorDetail: 'El recurso ya no existe.',
        })) ?? record;
      }

      // V7.1 §5.2: una histórica, o una vinculada sin modelo, no se procesa
      // aunque haya llegado a la cola (p. ej., encolada antes de esta versión).
      const cred = contexto.credential;
      if (cred && !cred.ruta.procesar) return await this.omitirFases(record, cred.ruta.motivo, cred.evidenciaMinima);

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
    if (ctx.sinOcr) return this.registrarEvidenciaDeProyecto(record, ctx);
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
    if (!guardado) return record;

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
   * V6 §7.1–§7.2: la evidencia de un proyecto es un registro privado de
   * funcionamiento y procedencia, no un documento que se lea. Queda
   * «declarada» (no se afirma que sea auténtica); si es un enlace, solo se
   * comprueba que responde (con la misma protección SSRF de siempre).
   */
  private async registrarEvidenciaDeProyecto(record: ValidationRecord, ctx: ValidationContext): Promise<ValidationRecord> {
    const linkCheck = ctx.declaredUrl ? await this.linkChecker.check(ctx.declaredUrl) : null;
    const guardado = await this.finish(record, {
      status: ValidationStatus.COMPLETED,
      backingTier: BackingTier.DECLARED,
      extractedData: null,
      identityMatchStatus: IdentityMatchStatus.UNKNOWN,
      linkCheck,
      duplicateOfId: null,
      errorCode: null,
      errorDetail: null,
    });
    if (!guardado) return record;
    await this.audit.record({
      actorUserId: null,
      eventType: AuditEventType.VALIDATION_COMPLETED,
      entityType: record.resourceType,
      entityId: record.resourceId,
      metadata: { status: ValidationStatus.COMPLETED, backingTier: BackingTier.DECLARED, linkStatus: linkCheck?.status ?? null, sinOcr: true },
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
    const { extracted, texto, bakedBadge, identity, duplicateOfId } = await this.leerDocumento(ctx, pipeline);

    // V9 · 1. El archivo en sí: con qué se hizo, si se retocó, si trae una
    // firma digital verificable, si declara haber sido generado con IA.
    const oficiales = officialDomainsFor(ctx.declaredIssuer, cred.opportunity?.expectedDomains ?? []);
    const forense: ForensicReport | null = ctx.file
      ? await this.forensics.analyze(ctx.file.buffer, ctx.file.mimeType, { issuer: ctx.declaredIssuer, officialDomains: oficiales })
      : null;
    if (forense) pipeline.push(`forensics:${forense.kind}`);
    if (forense?.signature) pipeline.push(`pdf_signature:${firmadoPorElEmisor(forense) ? 'issuer' : 'present'}`);
    // Firmado por el emisor, de punta a punta, y a nombre del estudiante.
    const documentoFirmado = firmadoPorElEmisor(forense) && identity === IdentityMatchStatus.MATCH;

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
      signedDocument: documentoFirmado,
    });
    const check = verificacion.check;
    pipeline.push(`qr:${check.qr}`);
    if (check.url) pipeline.push(`verification:${check.urlSource}`);
    if (check.openBadge) pipeline.push(`open_badge:${check.openBadge.format}`);
    // V7.1 §5.3 · Fase 1: el archivo frente al certificado modelo vigente.
    // Es ayuda para Dirección: no cambia el respaldo ni decide nada.
    const comparacion = cred.modelo ? await this.compararConElModelo(cred.modelo, texto, extracted, identity) : null;
    if (comparacion) pipeline.push(`model_comparison:${comparacion.modelReadable && comparacion.fileReadable ? 'done' : 'unreadable'}`);
    pipeline.push('comparison', 'ai:not_used', 'backing:deterministic');

    const legible = texto.length >= MIN_USEFUL_TEXT;
    const contradicciones = this.contradicciones(cred, extracted, texto, identity, check.status);
    // V4.1 B30: la página oficial individual nombra a otra persona.
    if (check.status === CredentialCheckStatus.MISMATCH && check.official === true && check.page?.otherHolder) {
      contradicciones.push('official_holder_mismatch');
    }
    // V9 · 2. La insignia la emitió otra organización que la declarada.
    if (check.openBadge?.issuerMatches === false) contradicciones.push('badge_issuer_mismatch');

    // V9 · 3. Coherencia interna: el código impreso frente al del QR.
    const qrVsTexto = qrContradiceCodigo([cred.declaredCredentialId, extracted?.credentialId], extracted?.qrPayloads ?? []);
    if (qrVsTexto) contradicciones.push('qr_code_mismatch');

    // V9 · 4. Lo comprobable del archivo que acusa: firma rota, edición tras
    // la firma, marca explícita de IA.
    const criticas = (forense?.signals ?? []).filter((x) => CRITICAL_FORENSIC_CODES.includes(x.code));
    if (criticas.some((x) => x.code === 'ai_generated')) contradicciones.push('ai_generated_document');
    if (criticas.some((x) => x.code === 'signature_broken' || x.code === 'modified_after_signature')) contradicciones.push('document_tampered');

    // V9 · 5. La misma credencial en el perfil de otro estudiante.
    const compartida = await this.compartida(ctx, cred, extracted, verificacion.check, forense);
    if (compartida.sameFile || compartida.sameCredentialId || compartida.sameUrl) contradicciones.push('shared_with_other_student');
    if (forense && compartida.nearDuplicate > 0) {
      agregarSenal(forense.signals, { code: 'near_duplicate_other_student', severity: 'warning', detail: null });
    }

    // Una advertencia forense (editor de imágenes, ediciones sucesivas…) no
    // acusa, pero el documento ya no respalda por sí solo: hace falta la
    // fuente oficial o una persona.
    const advertencia = (forense?.signals ?? []).some((x) => x.severity === 'warning');
    const metadataCoherente = !advertencia && legible && identity !== IdentityMatchStatus.MISMATCH && this.metadataEncaja(extracted!, ctx);
    const contextoOportunidad = !advertencia && !!cred.opportunity && legible && identity !== IdentityMatchStatus.MISMATCH
      && this.encajaConOportunidad(texto, cred.opportunity);

    let tier = decideCredentialBacking({
      identity,
      check: check.status,
      metadataCoherent: metadataCoherente,
      opportunityContextMatch: contextoOportunidad,
      officialReachable: verificacion.link?.status === LinkCheckStatus.AVAILABLE && check.official === true,
      contradictions: contradicciones,
    });
    tier = ajustarPorRevisionManual(tier, record.manualReviewStatus);

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
      credentialCheck: {
        ...check,
        contradictions: contradicciones,
        pipeline,
        aiUsed: false,
        forensics: forense,
        sharing: compartida,
        qrCodeMismatch: qrVsTexto,
        documentComparison: comparacion,
      },
      errorCode: sinConclusion ? 'NO_CONCLUSIVE_SIGNAL' : null,
      errorDetail: sinConclusion
        ? 'No se pudo leer el documento ni comprobar una fuente oficial. La credencial se conserva.'
        : null,
    });
    // C19: el archivo cambió mientras se procesaba. Este resultado no es de él.
    if (!guardado) return record;

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

    if (contradicciones.includes('shared_with_other_student')) {
      // Dirección lo encuentra en la auditoría; el estudiante solo ve que su
      // credencial ya figura en otro perfil.
      await this.audit.record({
        actorUserId: null,
        eventType: AuditEventType.EXTERNAL_CREDENTIAL_SHARED,
        entityType: record.resourceType,
        entityId: record.resourceId,
        metadata: { ...compartida },
      });
    }

    if (tier === BackingTier.FLAGGED) await this.avisarCredencialSenalada(cred.ownerUserId, record.resourceId, guardado);
    return guardado;
  }

  /** V9: ¿la misma credencial (archivo, código, enlace o imagen) está en otro perfil? */
  private async compartida(
    ctx: ValidationContext,
    cred: CredentialContext,
    extracted: ValidationRecord['extractedData'],
    check: { url: string | null; finalUrl: string | null },
    forense: ForensicReport | null,
  ): Promise<SharedCredentialResult> {
    try {
      return await this.shared.check({
        studentProfileId: ctx.studentProfileId,
        certificateId: cred.certificateId,
        fileSha256: ctx.file?.sha256 ?? null,
        credentialIds: [cred.declaredCredentialId, extracted?.credentialId],
        urls: [ctx.declaredUrl, check.url, check.finalUrl, extracted?.verificationUrl, ...(extracted?.qrPayloads ?? [])],
        perceptualHash: forense?.perceptualHash ?? null,
      });
    } catch (e) {
      this.logger.warn(`No se pudo buscar la credencial en otros perfiles: ${(e as Error).message}`);
      return { sameFile: 0, sameCredentialId: 0, sameUrl: 0, nearDuplicate: 0 };
    }
  }

  /** Lee el archivo (si lo hay): datos, texto, insignia horneada, titular y posible duplicado. */
  private async leerDocumento(ctx: ValidationContext, pipeline: string[]) {
    if (!ctx.file) {
      pipeline.push('document:none');
      return {
        extracted: null as ValidationRecord['extractedData'],
        texto: '',
        bakedBadge: null as { json: unknown; url: string | null } | null,
        identity: IdentityMatchStatus.UNKNOWN,
        duplicateOfId: null as string | null,
      };
    }
    const duplicateOfId = await this.findDuplicate(ctx.file);
    const completo = await this.extraction.extractFull(ctx.file.buffer, ctx.file.mimeType);
    const extracted = completo.data;
    pipeline.push(extracted.source === 'none' ? 'document:unreadable' : `document:${extracted.source}`);
    return {
      extracted: extracted as ValidationRecord['extractedData'],
      texto: completo.text,
      bakedBadge: completo.bakedBadge as { json: unknown; url: string | null } | null,
      identity: compareHolderName(ctx.holderName, extracted.holderName),
      duplicateOfId: duplicateOfId as string | null,
    };
  }

  /**
   * V7.1 §5.3 · Fase 1: compara el archivo con el certificado modelo. Primero
   * el texto nativo del PDF y OCR solo si hace falta (lo resuelve la
   * extracción). El titular del modelo es otra persona: sus líneas no cuentan,
   * y el del archivo se compara con el estudiante (`identity`).
   */
  private async compararConElModelo(
    modelo: ModeloVigente,
    textoArchivo: string,
    extracted: ValidationRecord['extractedData'],
    identity: IdentityMatchStatus,
  ): Promise<DocumentComparison> {
    const base = { referenceVersionId: modelo.version.id, holder: identity };
    const archivo = await this.loadFile(modelo.version.storedFileId);
    if (!archivo) {
      return {
        ...base, modelReadable: false, fileReadable: textoArchivo.length >= MIN_USEFUL_TEXT,
        matched: [], variations: [], missing: [],
        limitations: ['El certificado modelo ya no está disponible: la comparación no se hizo.'],
      };
    }
    try {
      const delModelo = await this.extraction.extractFull(archivo.buffer, archivo.mimeType);
      return {
        ...base,
        ...compararConModelo(delModelo.text, textoArchivo, {
          titularModelo: delModelo.data.holderName,
          modeloPorOcr: delModelo.data.source === 'ocr',
          archivoPorOcr: extracted?.source === 'ocr',
        }),
      };
    } catch (e) {
      this.logger.warn(`No se pudo leer el certificado modelo ${modelo.version.id}: ${(e as Error).message}`);
      return {
        ...base, modelReadable: false, fileReadable: textoArchivo.length >= MIN_USEFUL_TEXT,
        matched: [], variations: [], missing: [],
        limitations: ['No se pudo leer el certificado modelo: la comparación no se hizo.'],
      };
    }
  }

  /**
   * V7.1 §5.2: cierra sin procesar un trabajo que no corresponde (histórica o
   * vinculada sin modelo). Archiva lo que hubiera y, con la evidencia mínima,
   * deja pedida la revisión de Dirección si nadie la había pedido.
   */
  private async omitirFases(record: ValidationRecord, motivo: ProcessingSkipReason, evidenciaMinima: boolean): Promise<ValidationRecord> {
    const guardado = await this.aplicarSiVigente(record, {
      status: ValidationStatus.NOT_APPLICABLE,
      skippedReason: motivo,
      referenceVersionId: null,
      extractedData: null,
      credentialCheck: null,
      linkCheck: null,
      identityMatchStatus: IdentityMatchStatus.UNKNOWN,
      duplicateOfId: null,
      errorCode: null,
      errorDetail: null,
      finishedAt: new Date(),
      claimedBy: null,
    }, 'rerouted');
    if (!guardado) return (await this.records.findOne({ where: { id: record.id } })) ?? record;
    if (evidenciaMinima && guardado.manualReviewStatus === null) {
      await this.records.update(
        { id: record.id, manualReviewStatus: IsNull() },
        { manualReviewStatus: ManualReviewStatus.REQUESTED, manualReviewRequestedAt: new Date() },
      );
    }
    return (await this.records.findOne({ where: { id: record.id } })) ?? guardado;
  }

  /** Avisa al estudiante que una credencial quedó señalada; el aviso nunca deshace el veredicto. */
  private async avisarCredencialSenalada(userId: string, resourceId: string, guardado: ValidationRecord): Promise<void> {
    try {
      await this.notifications.emit({
        userId,
        kind: 'EXTERNAL_CREDENTIAL_FLAGGED',
        title: 'Revisa una credencial',
        body: 'Algo no coincide en una credencial que registraste. No se borró: corrige los datos o el archivo.',
        link: '/student/evidences',
        dedupeKey: `credential-flagged:${resourceId}:${guardado.finishedAt?.toISOString() ?? ''}`,
      });
    } catch {
      // La notificación nunca deshace el veredicto.
    }
  }

  /** Contradicciones significativas (§19 FLAGGED). Solo con datos legibles: sin texto no se acusa a nadie. */
  private contradicciones(
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
    return out;
  }

  /** §19 SUPPORTED: el documento coincide con lo que se esperaba de la oportunidad. */
  private encajaConOportunidad(texto: string, op: NonNullable<CredentialContext['opportunity']>): boolean {
    const esperado = [op.expectedCourseName, ...op.expectedKeywords].filter((x): x is string => !!x);
    const curso = esperado.some((k) => phraseFound(texto, k));
    const proveedor = !!op.provider && phraseFound(texto, op.provider, 0.5);
    return curso && proveedor;
  }

  // ====================================================================
  //  V3 §16 · Revisión manual excepcional
  // ====================================================================

  /** ¿Puede pedirse? Histórica, ya comprobada, sin verificador que concluya, sin contradicciones. */
  canRequestManualReview(record: ValidationRecord, cert: Pick<ExternalCertificate, 'source' | 'storedFileId' | 'certificateUrl'>): boolean {
    // V7.1 §5.2: lo enviado desde esta versión ya llega pedido a Dirección. Si
    // no lo está, es porque faltaba la evidencia mínima: con ella, se pide.
    if (record.status === ValidationStatus.NOT_APPLICABLE) {
      return record.manualReviewStatus === null && tieneEvidenciaMinima(cert);
    }
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

  /**
   * V7.1 §5.3: ¿el estudiante puede pedir «Comprobar información»? Solo una
   * vinculada que ya va por la ruta de comprobación (tenía modelo al
   * enviarse), terminada, sin decisión de Dirección y con algo que comprobar.
   */
  puedeRecomprobar(record: ValidationRecord, cert: Pick<ExternalCertificate, 'source' | 'storedFileId' | 'certificateUrl'>): boolean {
    return cert.source === ExternalCredentialSource.OPPORTUNITY
      && [ValidationStatus.COMPLETED, ValidationStatus.INCONCLUSIVE, ValidationStatus.FAILED].includes(record.status)
      && !revisionDecidida(record.manualReviewStatus)
      && tieneEvidenciaMinima(cert);
  }

  /** «Comprobar información» del estudiante: con las mismas reglas que la UI. */
  async recomprobarPorEstudiante(ownerUserId: string, cert: ExternalCertificate): Promise<ValidationRecord> {
    const record = await this.findForOrFail(ValidationResourceType.EXTERNAL_CERTIFICATE, cert.id);
    if (record.status === ValidationStatus.NOT_APPLICABLE) {
      throw new ConflictException({
        code: 'RECHECK_NOT_APPLICABLE',
        message: record.skippedReason === ProcessingSkipReason.HISTORICAL
          ? 'Una credencial obtenida fuera de Afinia no se compara automáticamente: la revisa Dirección.'
          : 'La oportunidad no tenía certificado modelo cuando la enviaste: la revisa Dirección directamente.',
      });
    }
    return this.recomprobarCredencial(cert.id, { actorUserId: ownerUserId, explicita: true });
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

  /** V4.1 A41-018: estado de validación de una credencial (eje aparte del respaldo). */
  validationStatusOf(record: ValidationRecord): CredentialValidationStatus {
    return deriveCredentialValidationStatus({
      job: record.status,
      check: record.credentialCheck?.status ?? null,
      contradictions: record.credentialCheck?.contradictions ?? [],
      openBadge: record.credentialCheck?.openBadge ?? null,
      manualReview: record.manualReviewStatus,
      backing: record.backingTier,
    });
  }

  validationStatusView(record: ValidationRecord) {
    const status = this.validationStatusOf(record);
    return { status, label: CREDENTIAL_VALIDATION_LABEL[status] };
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
        // V7.1 §5.2: origen y estado técnico, para que Dirección sepa qué se comprobó y qué no.
        'c.source AS source', 'a.title AS "activityTitle"',
        'v.status AS "processingStatus"', 'v.skipped_reason AS "skippedReason"',
      ])
      .leftJoin(Activity, 'a', 'a.id = c.activity_id')
      .where('v.resource_type = :t', { t: ValidationResourceType.EXTERNAL_CERTIFICATE })
      .andWhere('v.manual_review_status = :r', { r: ManualReviewStatus.REQUESTED })
      .orderBy('v.manual_review_requested_at', 'ASC')
      .limit(200)
      .getRawMany();
    return filas;
  }

  /**
   * V4.1 A41-018 (§6.2, A.8, B32). Tres decisiones posibles:
   * - verificada: método con prueba externa independiente + la prueba
   *   (URL distinta de la del propio certificado, o referencia concreta);
   * - inconclusa: hubo revisión, pero sin fuente que verifique emisor o
   *   titular; el respaldo no sube de SUPPORTED;
   * - rechazada: contradicción fuerte documentada; queda FLAGGED.
   * Dirección decide; Administración puede hacerlo como soporte excepcional
   * (queda auditado con su rol).
   */
  async decideManualReview(
    reviewer: { userId: string; role: string },
    certificateId: string,
    decisionPedida: ManualReviewStatus,
    reason: string,
    method?: ManualReviewMethod | null,
    proof?: string | null,
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

    const decision = decisionPedida === ManualReviewStatus.NOT_CORROBORATED ? ManualReviewStatus.INCONCLUSIVE : decisionPedida;
    const prueba = proof?.trim() || null;
    if (decision === ManualReviewStatus.CORROBORATED) exigirPruebaExterna(method, prueba, cert.certificateUrl);

    record.manualReviewStatus = decision;
    record.manualReviewerId = reviewer.userId;
    record.manualReviewedAt = new Date();
    record.manualReviewReason = reason.trim().slice(0, 500);
    record.manualReviewMethod = method ?? null;
    record.manualReviewProof = prueba ? prueba.slice(0, 500) : null;
    record.backingTier = respaldoTrasRevision(decision, record.backingTier);
    const guardado = await this.records.save(record);

    await this.audit.record({
      actorUserId: reviewer.userId,
      eventType: AuditEventType.EXTERNAL_CREDENTIAL_MANUAL_REVIEWED,
      entityType: ValidationResourceType.EXTERNAL_CERTIFICATE,
      entityId: certificateId,
      metadata: {
        decision,
        reason: record.manualReviewReason,
        method: record.manualReviewMethod,
        proof: record.manualReviewProof,
        reviewerRole: reviewer.role,
        backingTier: guardado.backingTier,
        validationStatus: this.validationStatusOf(guardado),
      },
    });
    await this.trajectory.requestRecalculation(cert.studentProfileId);
    try {
      await this.notifications.emit({
        userId: cert.studentProfile.userId,
        kind: 'EXTERNAL_CREDENTIAL_MANUAL_REVIEWED',
        title: decision === ManualReviewStatus.CORROBORATED ? 'Credencial verificada' : 'Revisión de credencial',
        body: avisoDeRevision(decision, cert.certificateName, record.manualReviewReason),
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
    // V7.1 §5.1–§5.2: no se reprocesan las credenciales que hoy no se procesan
    // (históricas y vinculadas sin modelo). Reabrirlas alteraría su respaldo y
    // la afinidad histórica sin informe de impacto.
    const viejos = await this.records
      .createQueryBuilder('v')
      .where('v.validator_version < :version', { version: VALIDATOR_VERSION })
      .andWhere('v.status NOT IN (:...omitidos)', { omitidos: [ValidationStatus.PROCESSING, ValidationStatus.NOT_APPLICABLE] })
      .andWhere(`NOT (v.resource_type = :cert AND EXISTS (
        SELECT 1 FROM external_certificates c
          LEFT JOIN external_opportunity_validation_references r ON r.activity_id = c.activity_id
         WHERE c.id = v.resource_id
           AND (c.source <> :vinculada OR r.sample_stored_file_id IS NULL)))`, {
        cert: ValidationResourceType.EXTERNAL_CERTIFICATE,
        vinculada: ExternalCredentialSource.OPPORTUNITY,
      })
      .orderBy('v.created_at', 'ASC')
      .take(limit)
      .getMany();
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

  /**
   * Escribe el veredicto. `null` si ya no corresponde aplicarlo (ver
   * `aplicarSiVigente`): quien llama no debe auditarlo ni avisar nada.
   */
  private async finish(
    record: ValidationRecord,
    cambios: Partial<ValidationRecord>,
  ): Promise<ValidationRecord | null> {
    const guardado = await this.aplicarSiVigente(record, {
      ...cambios,
      finishedAt: new Date(),
      claimedBy: null,
      validatorVersion: VALIDATOR_VERSION,
    });
    if (guardado) await this.recalcularDueno(guardado);
    return guardado;
  }

  /**
   * V7.1 §5.3 (C19, C28) · Aplica lo que produjo el worker solo si el trabajo
   * sigue siendo suyo: la fila en proceso, reclamada por él y con el mismo
   * archivo. La fila queda bloqueada mientras tanto.
   *
   * Nunca escribe la revisión humana. Si Dirección decidió mientras se
   * procesaba, el respaldo se ajusta a su decisión, que es la que manda. Antes
   * se guardaba la entidad entera leída al reclamar, y un resultado tardío
   * podía devolver la revisión a su estado anterior.
   */
  private async aplicarSiVigente(
    record: ValidationRecord,
    valores: Partial<ValidationRecord>,
    archivarComo?: PreviousValidationResult['reason'],
  ): Promise<ValidationRecord | null> {
    const aplicado = await this.records.manager.transaction(async (em) => {
      const actual = await em.findOne(ValidationRecord, { where: { id: record.id }, lock: { mode: 'pessimistic_write' } });
      if (!actual || !resultadoVigente(actual, record)) return null;
      const limpio: Record<string, unknown> = { ...valores };
      for (const k of CAMPOS_DE_REVISION) delete limpio[k];
      if (valores.backingTier !== undefined) {
        limpio.backingTier = ajustarPorRevisionManual(valores.backingTier, actual.manualReviewStatus);
      }
      if (archivarComo && hayResultadoQueArchivar(actual)) {
        limpio.previousResults = archivar(actual.previousResults, fotoDelResultado(actual, archivarComo));
      }
      await em.update(ValidationRecord, { id: record.id }, limpio as never);
      return em.findOne(ValidationRecord, { where: { id: record.id } });
    });
    if (!aplicado) {
      this.logger.log(`Resultado descartado (${record.resourceType}/${record.resourceId}): el archivo o el trabajo cambió mientras se procesaba.`);
      await this.audit.record({
        actorUserId: null,
        eventType: AuditEventType.VALIDATION_RESULT_DISCARDED,
        entityType: record.resourceType,
        entityId: record.resourceId,
        metadata: { claimedBy: record.claimedBy, fileSha256: record.fileSha256 ?? null },
      });
    }
    return aplicado;
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
      // Igual que un veredicto: solo si el trabajo sigue siendo este (C19).
      const reintento = await this.aplicarSiVigente(record, {
        status: ValidationStatus.PENDING,
        claimedBy: null,
        nextAttemptAt: new Date(Date.now() + espera * 1000),
        errorCode: 'RETRY',
        errorDetail: detalle,
      });
      return reintento ?? record;
    }

    return (await this.finish(record, {
      status: ValidationStatus.FAILED,
      errorCode: 'MAX_ATTEMPTS',
      errorDetail: detalle,
    })) ?? record;
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
      const modelo = await this.modeloDe(cert);
      const ruta = rutaDeCredencial(cert.source, !!modelo);
      // V9: además del institucional, los correos personales que el
      // estudiante demostró controlar (Credly y Open Badges usan esos).
      const personales = await this.verifiedEmails.find({ where: { userId: cert.studentProfile.userId, verifiedAt: Not(IsNull()) } });
      return {
        holderName: this.nombreDe(cert.studentProfile),
        declaredIssuer: cert.issuer,
        declaredTitle: cert.certificateName,
        declaredDate: cert.issueDate,
        declaredUrl: cert.certificateUrl,
        studentProfileId: cert.studentProfileId,
        // Sin procesamiento, el archivo ni siquiera se lee del almacenamiento.
        file: ruta.procesar ? await this.loadFile(cert.storedFileId) : null,
        credential: {
          ruta,
          modelo,
          evidenciaMinima: tieneEvidenciaMinima(cert),
          ownerUserId: cert.studentProfile.userId,
          emails: [
            ...(cert.studentProfile.user?.email ? [cert.studentProfile.user.email] : []),
            ...personales.map((e) => e.email),
          ],
          certificateId: cert.id,
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
    // V6 §7.1: la evidencia de un proyecto no pasa por OCR ni extracción. Ni la
    // captura ni el documento deciden tecnologías, calidad o funcionamiento;
    // por eso tampoco se leen sus bytes. El OCR sigue para credenciales.
    const deProyecto = !!evidencia.projectId && !evidencia.activityId;
    return {
      holderName: this.nombreDe(evidencia.studentProfile),
      declaredIssuer: null,
      declaredTitle: evidencia.description,
      declaredDate: null,
      declaredUrl: evidencia.externalUrl,
      studentProfileId: evidencia.studentProfileId,
      file: deProyecto ? null : await this.loadFile(evidencia.storedFileId),
      sinOcr: deProyecto,
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
        notApplicable: porEstado[ValidationStatus.NOT_APPLICABLE] ?? 0,
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
  /** V7.1 §5.2: si se procesa o por qué no. */
  ruta: RutaDeCredencial;
  /** V7.1 D03: certificado modelo vigente, para la fase 1. */
  modelo: ModeloVigente | null;
  /** D08: archivo o enlace individual. */
  evidenciaMinima: boolean;
  ownerUserId: string;
  /** V9: para buscar la misma credencial en otros perfiles. */
  certificateId: string;
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
  /** V6 §7.1: evidencia de proyecto; se registra sin OCR ni extracción. */
  sinOcr?: boolean;
}
