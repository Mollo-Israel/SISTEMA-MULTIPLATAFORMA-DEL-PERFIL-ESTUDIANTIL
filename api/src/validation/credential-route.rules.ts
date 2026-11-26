import {
  ExternalCredentialSource,
  ManualReviewStatus,
  ProcessingSkipReason,
  ValidationStatus,
} from '@perfil/shared';
import type { PreviousValidationResult, ValidationRecord } from '../entities/validation-record.entity';

/**
 * V7.1 §5.2–§5.3 · Reglas puras del envío de una credencial externa.
 *
 * Sin base de datos ni red: el servicio decide con ellas y las pruebas
 * unitarias las fijan.
 */

/** Qué hace el sistema con una credencial al enviarse. */
export type RutaDeCredencial =
  | { procesar: true }
  | { procesar: false; motivo: ProcessingSkipReason };

/**
 * - Histórica (antes o fuera de Afinia): las fases 1 y 2 no aplican. No se
 *   lee el archivo ni se consulta nada; va directo a Dirección.
 * - Vinculada sin certificado modelo: se omiten por falta de referencia.
 * - Vinculada con modelo: se comprueba (fase 1 con el modelo, fase 2 con el
 *   QR, el enlace o el código).
 */
export function rutaDeCredencial(source: ExternalCredentialSource, tieneModelo: boolean): RutaDeCredencial {
  if (source !== ExternalCredentialSource.OPPORTUNITY) return { procesar: false, motivo: ProcessingSkipReason.HISTORICAL };
  if (!tieneModelo) return { procesar: false, motivo: ProcessingSkipReason.NO_REFERENCE_MODEL };
  return { procesar: true };
}

/**
 * D08: la evidencia mínima no cambia. Un archivo o un enlace individual
 * bastan para pedir la revisión; sin ninguno de los dos, la credencial queda
 * declarada y no llega a Dirección.
 */
export function tieneEvidenciaMinima(c: { storedFileId: string | null; certificateUrl: string | null }): boolean {
  return !!(c.storedFileId || c.certificateUrl);
}

/** ¿Hay una decisión de Dirección (no solo un pedido)? */
export function revisionDecidida(estado: ManualReviewStatus | null | undefined): boolean {
  return !!estado && estado !== ManualReviewStatus.REQUESTED;
}

/**
 * C19 / C28: un resultado del worker se aplica solo si el trabajo sigue
 * siendo el suyo. Es decir, la fila sigue en proceso, la reclamó él y el
 * archivo es el mismo. Si el estudiante reemplazó el archivo o se volvió a
 * encaminar mientras tanto, el resultado viejo se descarta.
 */
export function resultadoVigente(
  actual: Pick<ValidationRecord, 'status' | 'claimedBy' | 'fileSha256'>,
  reclamado: Pick<ValidationRecord, 'claimedBy' | 'fileSha256'>,
): boolean {
  return actual.status === ValidationStatus.PROCESSING
    && !!reclamado.claimedBy
    && actual.claimedBy === reclamado.claimedBy
    && (actual.fileSha256 ?? null) === (reclamado.fileSha256 ?? null);
}

/** Cuántos intentos anteriores se conservan por credencial. */
export const MAX_RESULTADOS_ARCHIVADOS = 10;

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

/** ¿Hay algo que valga la pena archivar antes de volver a empezar? */
export function hayResultadoQueArchivar(r: ValidationRecord): boolean {
  const terminado = [
    ValidationStatus.COMPLETED, ValidationStatus.INCONCLUSIVE, ValidationStatus.FAILED, ValidationStatus.NOT_APPLICABLE,
  ].includes(r.status);
  return terminado || !!r.manualReviewStatus || !!r.fileSha256 || !!r.credentialCheck;
}

/** Foto del resultado vigente, tal como quedó, para el historial. */
export function fotoDelResultado(r: ValidationRecord, reason: PreviousValidationResult['reason'], ahora = new Date()): PreviousValidationResult {
  return {
    archivedAt: ahora.toISOString(),
    reason,
    status: r.status,
    backingTier: r.backingTier,
    fileSha256: r.fileSha256 ?? null,
    skippedReason: r.skippedReason ?? null,
    referenceVersionId: r.referenceVersionId ?? null,
    finishedAt: iso(r.finishedAt),
    identityMatchStatus: r.identityMatchStatus,
    extractedData: r.extractedData ?? null,
    credentialCheck: r.credentialCheck ?? null,
    linkCheck: r.linkCheck ?? null,
    errorCode: r.errorCode ?? null,
    manualReview: r.manualReviewStatus
      ? {
        status: r.manualReviewStatus,
        requestedAt: iso(r.manualReviewRequestedAt),
        note: r.manualReviewNote ?? null,
        reviewerId: r.manualReviewerId ?? null,
        reviewedAt: iso(r.manualReviewedAt),
        reason: r.manualReviewReason ?? null,
        method: r.manualReviewMethod ?? null,
        proof: r.manualReviewProof ?? null,
      }
      : null,
  };
}

/** El historial con la foto nueva al principio, acotado. */
export function archivar(
  historial: PreviousValidationResult[] | null | undefined,
  foto: PreviousValidationResult,
): PreviousValidationResult[] {
  return [foto, ...(historial ?? [])].slice(0, MAX_RESULTADOS_ARCHIVADOS);
}
