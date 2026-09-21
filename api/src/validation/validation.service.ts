import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  BackingTier,
  IdentityMatchStatus,
  LinkCheckStatus,
  ValidationResourceType,
  ValidationStatus,
} from '@perfil/shared';
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

/** Version del validador. Subirla permite reprocesar lo ya validado. */
export const VALIDATOR_VERSION = 1;

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
    return this.records.save(record);
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
        relations: { studentProfile: { user: true } },
      });
      if (!cert) return null;
      return {
        holderName: this.nombreDe(cert.studentProfile),
        declaredIssuer: cert.issuer,
        declaredTitle: cert.certificateName,
        declaredDate: cert.issueDate,
        declaredUrl: cert.certificateUrl,
        studentProfileId: cert.studentProfileId,
        file: await this.loadFile(cert.storedFileId),
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

interface ValidationContext {
  /** Nombre del titular según el sistema, para comparar con el del papel. */
  holderName: string;
  declaredIssuer: string | null;
  declaredTitle: string | null;
  declaredDate: string | null;
  declaredUrl: string | null;
  studentProfileId: string;
  file: LoadedFile | null;
}
