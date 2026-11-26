/**
 * V7.1 BATCH V7-4 · Revisión humana obligatoria (D01).
 *
 * Qué credencial cuenta, qué estado se muestra y qué nivel tiene en la
 * trayectoria, según la decisión de Dirección.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BackingTier, CredentialCheckStatus, CredentialValidationStatus, CREDENTIAL_VALIDATION_LABEL, IdentityMatchStatus,
  ManualReviewStatus, TrajectoryLevel, ValidationStatus, credencialCuenta,
} from '@perfil/shared';
import { deriveCredentialValidationStatus } from '../../src/validation/credential-check.rules';
import { fasesDeCredencial } from '../../src/validation/credential-phases.rules';
import { certificateCvEligible, certificateLevel } from '../../src/trajectory/cv-eligibility.rules';

const estado = (manualReview: ManualReviewStatus | null, check = CredentialCheckStatus.VERIFIED_MATCH) => deriveCredentialValidationStatus({
  job: ValidationStatus.COMPLETED, check, contradictions: [], openBadge: null, manualReview, backing: BackingTier.SUPPORTED,
});

describe('V7-4 qué credencial cuenta (§5.1)', () => {
  it('pendiente, observada o rechazada no cuenta', () => {
    for (const r of [ManualReviewStatus.REQUESTED, ManualReviewStatus.OBSERVED, ManualReviewStatus.REJECTED]) assert.equal(credencialCuenta(r), false);
  });
  it('aprobada por Dirección cuenta', () => {
    assert.equal(credencialCuenta(ManualReviewStatus.CORROBORATED), true);
    assert.equal(credencialCuenta(ManualReviewStatus.APPROVED), true);
  });
  it('C23: una anterior a la revisión obligatoria (sin revisión) conserva su comportamiento', () => {
    assert.equal(credencialCuenta(null), true);
  });
});

describe('V7-4 estado visible', () => {
  it('C11/C14: aunque la fuente coincida, mientras espera a Dirección dice «pendiente»', () => {
    assert.equal(estado(ManualReviewStatus.REQUESTED), CredentialValidationStatus.MANUAL_REVIEW_REQUIRED);
  });
  it('observada y aprobada tienen su propio estado', () => {
    assert.equal(estado(ManualReviewStatus.OBSERVED), CredentialValidationStatus.OBSERVED);
    assert.equal(estado(ManualReviewStatus.APPROVED), CredentialValidationStatus.APPROVED);
  });
  it('C22: «aprobada» no dice verificada ni auténtica; ninguna etiqueta promete autenticidad', () => {
    assert.doesNotMatch(CREDENTIAL_VALIDATION_LABEL[CredentialValidationStatus.APPROVED], /verificad|autentic/i);
    for (const l of Object.values(CREDENTIAL_VALIDATION_LABEL)) assert.doesNotMatch(l, /100 ?%|auténtic/i);
  });
  it('C23: la antigua corroborada por la fuente sigue diciendo que fue anterior a la revisión', () => {
    assert.equal(estado(null), CredentialValidationStatus.AUTO_VERIFIED);
    assert.match(CREDENTIAL_VALIDATION_LABEL[CredentialValidationStatus.AUTO_VERIFIED], /anterior/);
  });
});

describe('V7-4 trayectoria y exportación', () => {
  it('pendiente u observada: «inconclusa» y no exportable, aunque la máquina diga corroborada', () => {
    assert.equal(certificateLevel(BackingTier.CORROBORATED, ManualReviewStatus.REQUESTED), TrajectoryLevel.INCOMPLETE);
    assert.equal(certificateCvEligible(BackingTier.CORROBORATED, ManualReviewStatus.OBSERVED), false);
  });
  it('aprobada (con prueba o con el documento): revisada y exportable', () => {
    assert.equal(certificateLevel(BackingTier.SUPPORTED, ManualReviewStatus.APPROVED), TrajectoryLevel.REVIEWED);
    assert.equal(certificateCvEligible(BackingTier.SUPPORTED, ManualReviewStatus.APPROVED), true);
    assert.equal(certificateCvEligible(BackingTier.CORROBORATED, ManualReviewStatus.CORROBORATED), true);
  });
  it('C23: la antigua corroborada sin revisión sigue exportable', () => {
    assert.equal(certificateCvEligible(BackingTier.CORROBORATED, null), true);
  });
});

describe('V7-4 fase 3 en la vista del estudiante', () => {
  const base = {
    status: ValidationStatus.COMPLETED, skippedReason: null, credentialCheck: null, linkCheck: null,
    identityMatchStatus: IdentityMatchStatus.UNKNOWN, extractedData: null, finishedAt: new Date(),
    manualReviewRequestedAt: new Date(), manualReviewedAt: new Date(), manualReviewReason: 'Falta la página del código.',
  };
  it('observada: dice qué corregir y que mientras tanto no cuenta', () => {
    const f = fasesDeCredencial({ ...base, manualReviewStatus: ManualReviewStatus.OBSERVED }, { storedFileId: 'f', certificateUrl: null });
    assert.equal(f[2].estado, 'observada');
    assert.match(f[2].resumen, /no cuenta/);
    assert.match(f[2].detalles[0], /página del código/);
  });
  it('aprobada revisando el documento: con su alcance', () => {
    const f = fasesDeCredencial({ ...base, manualReviewStatus: ManualReviewStatus.APPROVED }, { storedFileId: 'f', certificateUrl: null });
    assert.equal(f[2].estado, 'decidida');
    assert.match(f[2].resumen, /respaldo parcial/);
  });
});
