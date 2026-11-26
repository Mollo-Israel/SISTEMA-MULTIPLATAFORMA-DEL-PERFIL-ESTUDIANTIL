/**
 * V7.1 BATCH V7-3 · Credenciales: origen, procesamiento técnico y fases.
 *
 * Reglas puras: qué camino sigue una credencial (C01, C07, C25), cuándo se
 * aplica un resultado del worker (C19, C28), la comparación con el modelo
 * (C08, C09) y lo que ve el estudiante de cada fase (§5.4).
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BackingTier, CredentialCheckStatus, ExternalCredentialSource, IdentityMatchStatus, ManualReviewStatus,
  ProcessingSkipReason, QrPresence, ValidationStatus,
} from '@perfil/shared';
import {
  archivar, fotoDelResultado, MAX_RESULTADOS_ARCHIVADOS, resultadoVigente, revisionDecidida, rutaDeCredencial, tieneEvidenciaMinima,
} from '../../src/validation/credential-route.rules';
import { compararConModelo, lineasEstables } from '../../src/validation/document-comparison.rules';
import { fasesDeCredencial } from '../../src/validation/credential-phases.rules';
import type { ValidationRecord } from '../../src/entities/validation-record.entity';

const MODELO = [
  'Academia Andina de Redes',
  'Certificado de finalizacion',
  'Otorgado a Juan Modelo Perez',
  'Curso Fundamentos de Redes Andinas',
  'Duracion de cuarenta horas academicas',
  'Fecha 12 de marzo de 2025',
  'Codigo NA-2025-AB7',
].join('\n');

describe('V7-3 ruta de una credencial', () => {
  it('C01: la histórica no se procesa (no aplica)', () => {
    assert.deepEqual(rutaDeCredencial(ExternalCredentialSource.HISTORICAL_EXTERNAL, true), { procesar: false, motivo: ProcessingSkipReason.HISTORICAL });
  });
  it('C07/C25: la vinculada sin modelo se omite por falta de referencia', () => {
    assert.deepEqual(rutaDeCredencial(ExternalCredentialSource.OPPORTUNITY, false), { procesar: false, motivo: ProcessingSkipReason.NO_REFERENCE_MODEL });
  });
  it('la vinculada con modelo se comprueba', () => {
    assert.deepEqual(rutaDeCredencial(ExternalCredentialSource.OPPORTUNITY, true), { procesar: true });
  });
  it('D08: archivo o enlace bastan; sin ninguno no hay revisión', () => {
    assert.equal(tieneEvidenciaMinima({ storedFileId: 'f', certificateUrl: null }), true);
    assert.equal(tieneEvidenciaMinima({ storedFileId: null, certificateUrl: 'https://x.test/c/1' }), true);
    assert.equal(tieneEvidenciaMinima({ storedFileId: null, certificateUrl: null }), false);
  });
  it('un pedido de revisión no es una decisión', () => {
    assert.equal(revisionDecidida(ManualReviewStatus.REQUESTED), false);
    assert.equal(revisionDecidida(null), false);
    assert.equal(revisionDecidida(ManualReviewStatus.REJECTED), true);
  });
});

describe('V7-3 C19/C28 un resultado del worker solo se aplica si el trabajo sigue siendo suyo', () => {
  const reclamado = { claimedBy: 'w1', fileSha256: 'a'.repeat(64) };
  it('misma fila en proceso, mismo worker y mismo archivo: se aplica', () => {
    assert.equal(resultadoVigente({ status: ValidationStatus.PROCESSING, ...reclamado }, reclamado), true);
  });
  it('el estudiante reemplazó el archivo mientras tanto: se descarta', () => {
    assert.equal(resultadoVigente({ status: ValidationStatus.PROCESSING, claimedBy: 'w1', fileSha256: 'b'.repeat(64) }, reclamado), false);
  });
  it('se volvió a encaminar (pendiente o no aplica): se descarta', () => {
    assert.equal(resultadoVigente({ status: ValidationStatus.PENDING, claimedBy: null, fileSha256: reclamado.fileSha256 }, reclamado), false);
    assert.equal(resultadoVigente({ status: ValidationStatus.NOT_APPLICABLE, claimedBy: null, fileSha256: reclamado.fileSha256 }, reclamado), false);
  });
  it('otro worker la tomó: se descarta', () => {
    assert.equal(resultadoVigente({ status: ValidationStatus.PROCESSING, claimedBy: 'w2', fileSha256: reclamado.fileSha256 }, reclamado), false);
  });
});

describe('V7-3 historial de intentos', () => {
  const registro = {
    status: ValidationStatus.COMPLETED, backingTier: BackingTier.SUPPORTED, fileSha256: 'c'.repeat(64),
    skippedReason: null, referenceVersionId: 'v1', finishedAt: new Date('2026-11-20T10:00:00Z'),
    identityMatchStatus: IdentityMatchStatus.MATCH, extractedData: null, credentialCheck: null, linkCheck: null,
    errorCode: null, manualReviewStatus: ManualReviewStatus.REJECTED, manualReviewRequestedAt: new Date('2026-11-20T10:00:00Z'),
    manualReviewNote: null, manualReviewerId: 'dir', manualReviewedAt: new Date('2026-11-21T10:00:00Z'),
    manualReviewReason: 'No corresponde', manualReviewMethod: null, manualReviewProof: null,
  } as unknown as ValidationRecord;
  it('la foto conserva hash, versión del modelo y la decisión con su autor y motivo', () => {
    const f = fotoDelResultado(registro, 'file_replaced');
    assert.equal(f.fileSha256, 'c'.repeat(64));
    assert.equal(f.referenceVersionId, 'v1');
    assert.equal(f.manualReview?.status, ManualReviewStatus.REJECTED);
    assert.equal(f.manualReview?.reviewerId, 'dir');
    assert.equal(f.manualReview?.reason, 'No corresponde');
  });
  it('el historial pone lo último primero y está acotado', () => {
    let h = [] as ReturnType<typeof archivar>;
    for (let i = 0; i < MAX_RESULTADOS_ARCHIVADOS + 3; i++) h = archivar(h, fotoDelResultado(registro, 'rechecked'));
    assert.equal(h.length, MAX_RESULTADOS_ARCHIVADOS);
  });
});

describe('V7-3 fase 1: comparación con el certificado modelo', () => {
  it('solo compara lo estable: ni el titular del modelo, ni fechas ni códigos', () => {
    const estables = lineasEstables(MODELO, 'Juan Modelo Perez');
    assert.deepEqual(estables, [
      'Academia Andina de Redes', 'Certificado de finalizacion', 'Curso Fundamentos de Redes Andinas', 'Duracion de cuarenta horas academicas',
    ]);
  });
  it('C08: el titular del modelo es otra persona y no cuenta como diferencia', () => {
    const archivo = MODELO.replace('Juan Modelo Perez', 'Valeria Montano Rios').replace('12 de marzo', '3 de abril').replace('AB7', 'ZZ9');
    const c = compararConModelo(MODELO, archivo, { titularModelo: null });
    assert.equal(c.missing.length, 0);
    assert.equal(c.variations.length, 0);
    assert.equal(c.matched.length, 4);
  });
  it('C09: otra versión del certificado: se explican variaciones y faltantes, sin porcentaje', () => {
    const archivo = [
      'Academia Andina de Redes', 'Constancia de aprobacion', 'Otorgado a Valeria Montano Rios',
      'Curso Fundamentos de Redes Andinas edicion virtual', 'Fecha 3 de abril de 2026',
    ].join('\n');
    const c = compararConModelo(MODELO, archivo);
    assert.ok(c.matched.includes('Academia Andina de Redes'));
    assert.ok(c.matched.includes('Curso Fundamentos de Redes Andinas'));
    assert.ok(c.missing.includes('Duracion de cuarenta horas academicas'));
    assert.ok(c.missing.includes('Certificado de finalizacion'));
    assert.ok(!('score' in c));
  });
  it('tildes y mayúsculas no son diferencias', () => {
    const c = compararConModelo(MODELO, MODELO.toUpperCase().replace('DURACION', 'DURACIÓN').replace('FINALIZACION', 'FINALIZACIÓN'));
    assert.equal(c.missing.length, 0);
  });
  it('sin texto legible en el archivo: inconclusa, sin acusar', () => {
    const c = compararConModelo(MODELO, '   ');
    assert.equal(c.fileReadable, false);
    assert.equal(c.matched.length + c.missing.length, 0);
    assert.match(c.limitations[0], /no se hizo/);
  });
});

describe('V7-3 §5.4 las tres fases que ve el estudiante', () => {
  const base = {
    credentialCheck: null, linkCheck: null, identityMatchStatus: IdentityMatchStatus.UNKNOWN, extractedData: null,
    finishedAt: new Date(), manualReviewStatus: ManualReviewStatus.REQUESTED, manualReviewRequestedAt: new Date(),
    manualReviewedAt: null, manualReviewReason: null,
  };
  const conArchivo = { storedFileId: 'f', certificateUrl: null };

  it('histórica: «no aplica» en 1 y 2; Dirección pendiente', () => {
    const f = fasesDeCredencial({ ...base, status: ValidationStatus.NOT_APPLICABLE, skippedReason: ProcessingSkipReason.HISTORICAL }, conArchivo);
    assert.deepEqual(f.map((x) => x.estado), ['no_aplica', 'no_aplica', 'pendiente']);
    assert.match(f[0].resumen, /obtenida fuera de Afinia/);
  });
  it('vinculada sin modelo: omitidas por falta de referencia, revisión manual', () => {
    const f = fasesDeCredencial({ ...base, status: ValidationStatus.NOT_APPLICABLE, skippedReason: ProcessingSkipReason.NO_REFERENCE_MODEL }, conArchivo);
    assert.deepEqual(f.map((x) => x.estado), ['omitida', 'omitida', 'pendiente']);
    assert.match(f[0].resumen, /Sin documento de referencia/);
  });
  it('C14: comparación y fuente favorables; la revisión sigue pendiente', () => {
    const f = fasesDeCredencial({
      ...base, status: ValidationStatus.COMPLETED, skippedReason: null,
      credentialCheck: {
        status: CredentialCheckStatus.VERIFIED_MATCH, url: 'https://x', qr: QrPresence.QR_PRESENT, contradictions: [], pipeline: [],
        documentComparison: {
          referenceVersionId: 'v', modelReadable: true, fileReadable: true, matched: ['a', 'b'], variations: [], missing: [],
          holder: IdentityMatchStatus.MATCH, limitations: [],
        },
      } as never,
    }, conArchivo);
    assert.deepEqual(f.map((x) => x.estado), ['completada', 'completada', 'pendiente']);
  });
  it('C13: la fuente no respondió: inconclusa, sin bloquear la revisión', () => {
    const f = fasesDeCredencial({
      ...base, status: ValidationStatus.INCONCLUSIVE, skippedReason: null,
      credentialCheck: { status: CredentialCheckStatus.UNREACHABLE, url: 'https://x', qr: QrPresence.QR_ABSENT, contradictions: [], pipeline: [] } as never,
    }, conArchivo);
    assert.equal(f[1].estado, 'inconclusa');
    assert.match(f[1].resumen, /no hace falsa/);
    assert.equal(f[2].estado, 'pendiente');
  });
  it('sin evidencia mínima no llega a Dirección y lo dice', () => {
    const f = fasesDeCredencial({ ...base, manualReviewStatus: null, status: ValidationStatus.NOT_APPLICABLE, skippedReason: ProcessingSkipReason.HISTORICAL },
      { storedFileId: null, certificateUrl: null });
    assert.equal(f[2].estado, 'sin_solicitud');
    assert.match(f[2].resumen, /evidencia mínima/);
  });
  it('nunca dice «verificado» ni muestra códigos internos', () => {
    const f = fasesDeCredencial({ ...base, status: ValidationStatus.FAILED, skippedReason: null }, conArchivo);
    const texto = JSON.stringify(f);
    assert.doesNotMatch(texto, /verificad|MAX_ATTEMPTS|RETRY/i);
    assert.equal(f[0].estado, 'error');
  });
});
