/**
 * V7.1 D04 (BATCH V7-2): qué participación confirmada es trayectoria.
 *
 * «Sin resultado» es asistencia operativa: no suma afinidad ni respaldo, no
 * respalda tecnologías y no entra al resumen exportable. Los pesos no
 * cambian; cambia la elegibilidad, y por eso sube la versión del motor.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ActivityOrigin, ActivityOutcomePolicy, AFFINITY_BOOT_BACKFILL_BELOW_VERSION, AFFINITY_ENGINE_VERSION,
  AFFINITY_POINTS_V4, cuentaComoTrayectoria, RegistrationStatus,
} from '@perfil/shared';
import { activityCvEligible } from '../../src/trajectory/cv-eligibility.rules';

describe('V7.1 D04 cuentaComoTrayectoria', () => {
  it('«Sin resultado» no es trayectoria', () => {
    assert.equal(cuentaComoTrayectoria(ActivityOutcomePolicy.NONE), false);
  });

  it('solo participación, certificado institucional y la constancia histórica sí', () => {
    assert.equal(cuentaComoTrayectoria(ActivityOutcomePolicy.PARTICIPATION_ONLY), true);
    assert.equal(cuentaComoTrayectoria(ActivityOutcomePolicy.INSTITUTION_ISSUED_CERTIFICATE), true);
    assert.equal(cuentaComoTrayectoria(ActivityOutcomePolicy.INTERNAL_CONSTANCY), true);
  });

  it('sin política conocida no se quita nada (dato histórico)', () => {
    assert.equal(cuentaComoTrayectoria(null), true);
    assert.equal(cuentaComoTrayectoria(undefined), true);
  });
});

describe('V7.1 D04 resumen exportable', () => {
  it('una confirmada «Sin resultado» no es exportable', () => {
    assert.equal(activityCvEligible(RegistrationStatus.CONFIRMED, ActivityOrigin.INTERNAL, ActivityOutcomePolicy.NONE), false);
  });

  it('una confirmada «Solo participación» sí, como antes', () => {
    assert.equal(activityCvEligible(RegistrationStatus.CONFIRMED, ActivityOrigin.INTERNAL, ActivityOutcomePolicy.PARTICIPATION_ONLY), true);
  });

  it('sigue exigiendo la asistencia confirmada y el origen interno', () => {
    assert.equal(activityCvEligible(RegistrationStatus.REGISTERED, ActivityOrigin.INTERNAL, ActivityOutcomePolicy.PARTICIPATION_ONLY), false);
    assert.equal(activityCvEligible(RegistrationStatus.CONFIRMED, ActivityOrigin.EXTERNAL, ActivityOutcomePolicy.PARTICIPATION_ONLY), false);
  });
});

describe('V7.1 §6.2 versión del motor y recálculo', () => {
  it('D04 cambia la elegibilidad, no los pesos', () => {
    assert.equal(AFFINITY_ENGINE_VERSION, 6);
    assert.equal(AFFINITY_POINTS_V4.ACTIVITY_CONFIRMED, 10);
  });

  it('al arrancar solo se migra estructura: la regla nueva no se aplica a todos en silencio', () => {
    assert.equal(AFFINITY_BOOT_BACKFILL_BELOW_VERSION, 5);
    assert.ok(AFFINITY_BOOT_BACKFILL_BELOW_VERSION < AFFINITY_ENGINE_VERSION);
  });
});
