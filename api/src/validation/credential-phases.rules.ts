import {
  CredentialCheckStatus,
  IdentityMatchStatus,
  LinkCheckStatus,
  ManualReviewStatus,
  ProcessingSkipReason,
  QrPresence,
  ValidationStatus,
} from '@perfil/shared';
import type { ValidationRecord } from '../entities/validation-record.entity';
import { tieneEvidenciaMinima } from './credential-route.rules';

/**
 * V7.1 §5.4 · Las tres fases de ayuda a la revisión, tal como se muestran.
 *
 * Cada fase dice lo que de verdad pasó: «no aplica», «omitida», «pendiente»,
 * un resultado con sus limitaciones, o un error técnico. Nunca un check verde
 * ficticio, y sin códigos internos: esos quedan en los registros técnicos.
 */

export type EstadoDeFase =
  | 'no_aplica'
  | 'omitida'
  | 'pendiente'
  | 'procesando'
  | 'completada'
  | 'inconclusa'
  | 'error'
  /** Fase 3: falta la evidencia mínima, así que no llegó a Dirección. */
  | 'sin_solicitud'
  /** Fase 3: Dirección ya decidió. */
  | 'decidida'
  /** Fase 3: Dirección pidió una corrección; el estudiante la reenvía. */
  | 'observada';

export interface FaseDeCredencial {
  fase: 1 | 2 | 3;
  titulo: string;
  estado: EstadoDeFase;
  resumen: string;
  detalles: string[];
  fecha: string | null;
}

type Registro = Pick<ValidationRecord,
  'status' | 'skippedReason' | 'credentialCheck' | 'linkCheck' | 'identityMatchStatus' | 'extractedData'
  | 'finishedAt' | 'manualReviewStatus' | 'manualReviewRequestedAt' | 'manualReviewedAt' | 'manualReviewReason'>;

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

const TITULAR: Record<IdentityMatchStatus, string> = {
  [IdentityMatchStatus.MATCH]: 'El nombre del archivo coincide con el tuyo.',
  [IdentityMatchStatus.PARTIAL_MATCH]: 'El nombre del archivo coincide en parte con el tuyo.',
  [IdentityMatchStatus.MISMATCH]: 'El nombre del archivo no corresponde al tuyo.',
  [IdentityMatchStatus.UNKNOWN]: 'No se pudo leer un nombre en el archivo.',
};

const FUENTE: Record<CredentialCheckStatus, string> = {
  [CredentialCheckStatus.VERIFIED_MATCH]: 'La fuente oficial muestra un registro individual que coincide con lo declarado.',
  [CredentialCheckStatus.REACHABLE_NO_STRUCTURED_PROOF]: 'La página responde, pero no muestra un registro individual legible.',
  [CredentialCheckStatus.MISMATCH]: 'Lo que muestra la fuente no coincide con lo declarado.',
  [CredentialCheckStatus.INCONCLUSIVE]: 'No se pudo comprobar la fuente.',
  [CredentialCheckStatus.UNREACHABLE]: 'La fuente no respondió (red, CAPTCHA o límite de consultas). Eso no hace falsa la credencial.',
  [CredentialCheckStatus.NO_VERIFIER]: 'No hay enlace, QR ni insignia que consultar.',
};

/** Lo común a las fases 1 y 2 antes de que haya un resultado. */
function faseSinResultado(r: Registro, fase: 1 | 2, titulo: string): FaseDeCredencial | null {
  const base = { fase, titulo, detalles: [] as string[], fecha: iso(r.finishedAt) };
  if (r.status === ValidationStatus.NOT_APPLICABLE) {
    if (r.skippedReason === ProcessingSkipReason.NO_REFERENCE_MODEL) {
      return {
        ...base, estado: 'omitida',
        resumen: 'Sin documento de referencia: la oportunidad no tiene certificado modelo. Se envió a revisión manual.',
      };
    }
    return {
      ...base, estado: 'no_aplica',
      resumen: fase === 1
        ? 'No aplica comparación automática: credencial obtenida fuera de Afinia.'
        : 'No aplica consulta automática. Dirección puede revisar a mano el enlace o el código que aportaste.',
    };
  }
  if (r.status === ValidationStatus.PENDING) return { ...base, estado: 'pendiente', resumen: 'En cola para comprobar.', fecha: null };
  if (r.status === ValidationStatus.PROCESSING) return { ...base, estado: 'procesando', resumen: 'Comprobando…', fecha: null };
  if (r.status === ValidationStatus.FAILED) {
    return {
      ...base, estado: 'error',
      resumen: 'No se pudo completar por un error técnico. La revisión de Dirección sigue disponible.',
    };
  }
  return null;
}

function fase1(r: Registro): FaseDeCredencial {
  const titulo = 'Lectura y comparación con el modelo';
  const previa = faseSinResultado(r, 1, titulo);
  if (previa) return previa;
  const fecha = iso(r.finishedAt);
  const c = r.credentialCheck?.documentComparison;
  if (!c) {
    // Comprobada antes de V7.1: se leyó el documento, sin comparación con modelo.
    const leido = !!r.extractedData && r.extractedData.source !== 'none';
    return {
      fase: 1, titulo, fecha,
      estado: leido ? 'completada' : 'inconclusa',
      resumen: leido
        ? 'Se leyó el documento. Esta comprobación es anterior a la comparación con un certificado modelo.'
        : 'No se pudo leer texto del archivo.',
      detalles: leido ? [TITULAR[r.identityMatchStatus]] : [],
    };
  }
  if (!c.modelReadable || !c.fileReadable) {
    return { fase: 1, titulo, fecha, estado: 'inconclusa', resumen: c.limitations[0] ?? 'No se pudo comparar.', detalles: c.limitations.slice(1) };
  }
  const detalles: string[] = [TITULAR[c.holder]];
  if (c.matched.length) detalles.push(`Coinciden: ${c.matched.map((x) => `«${x}»`).join(', ')}.`);
  for (const v of c.variations) detalles.push(`Varía: «${v.expected}» aparece como «${v.found}».`);
  if (c.missing.length) detalles.push(`No aparecen: ${c.missing.map((x) => `«${x}»`).join(', ')}.`);
  detalles.push(...c.limitations);
  return {
    fase: 1, titulo, fecha, estado: 'completada',
    resumen: `${c.matched.length} texto(s) del modelo coinciden, ${c.variations.length} con variaciones y ${c.missing.length} no aparecen. Es ayuda para la revisión, no una conclusión.`,
    detalles,
  };
}

function fase2(r: Registro): FaseDeCredencial {
  const titulo = 'QR, enlace y fuente externa';
  const previa = faseSinResultado(r, 2, titulo);
  if (previa) return previa;
  const fecha = iso(r.finishedAt);
  const ch = r.credentialCheck;
  if (!ch) return { fase: 2, titulo, fecha, estado: 'inconclusa', resumen: 'No hay resultado de esta fase.', detalles: [] };
  const detalles: string[] = [];
  detalles.push(ch.qr === QrPresence.QR_PRESENT
    ? 'Se leyó un QR. Un QR que lleva a la página del curso no identifica a quien lo cursó.'
    : 'El archivo no tiene QR.');
  if (r.linkCheck?.status === LinkCheckStatus.BLOCKED) {
    detalles.push('El enlace no se consultó por seguridad: apunta a una dirección interna o no permitida.');
  } else if (!ch.url) {
    detalles.push('No hay enlace de verificación.');
  }
  const inconclusa = ch.status === CredentialCheckStatus.UNREACHABLE || ch.status === CredentialCheckStatus.INCONCLUSIVE;
  return { fase: 2, titulo, fecha, estado: inconclusa ? 'inconclusa' : 'completada', resumen: FUENTE[ch.status], detalles };
}

function fase3(r: Registro, cert: { storedFileId: string | null; certificateUrl: string | null }): FaseDeCredencial {
  const titulo = 'Revisión de Dirección';
  const s = r.manualReviewStatus;
  if (s === ManualReviewStatus.REQUESTED) {
    return { fase: 3, titulo, estado: 'pendiente', resumen: 'Pendiente de revisión de Dirección.', detalles: [], fecha: iso(r.manualReviewRequestedAt) };
  }
  if (!s) {
    return tieneEvidenciaMinima(cert)
      ? { fase: 3, titulo, estado: 'sin_solicitud', resumen: 'No se pidió la revisión de Dirección.', detalles: [], fecha: null }
      : {
        fase: 3, titulo, estado: 'sin_solicitud', fecha: null, detalles: [],
        resumen: 'Falta la evidencia mínima: agrega el archivo o un enlace individual para enviarla a revisión.',
      };
  }
  const motivo = r.manualReviewReason ? [`Motivo: ${r.manualReviewReason}`] : [];
  if (s === ManualReviewStatus.OBSERVED) {
    return {
      fase: 3, titulo, estado: 'observada', detalles: motivo, fecha: iso(r.manualReviewedAt),
      resumen: 'Dirección la observó: corrígela según el motivo y vuelve a enviarla. Mientras tanto no cuenta.',
    };
  }
  const resumen: Record<string, string> = {
    [ManualReviewStatus.CORROBORATED]: 'Aprobada por Dirección tras contrastarla con una fuente externa.',
    [ManualReviewStatus.APPROVED]: 'Aprobada por Dirección revisando el documento (respaldo parcial, no una certificación).',
    [ManualReviewStatus.REJECTED]: 'Rechazada por Dirección.',
    [ManualReviewStatus.INCONCLUSIVE]: 'Dirección la revisó, pero no pudo contrastarla con una fuente externa.',
    [ManualReviewStatus.NOT_CORROBORATED]: 'Dirección la revisó, pero no pudo contrastarla con una fuente externa.',
  };
  return { fase: 3, titulo, estado: 'decidida', resumen: resumen[s] ?? 'Dirección la revisó.', detalles: motivo, fecha: iso(r.manualReviewedAt) };
}

export function fasesDeCredencial(
  r: Registro,
  cert: { storedFileId: string | null; certificateUrl: string | null },
): FaseDeCredencial[] {
  return [fase1(r), fase2(r), fase3(r, cert)];
}
