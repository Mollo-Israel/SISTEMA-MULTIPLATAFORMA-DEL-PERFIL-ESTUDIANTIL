/**
 * Jest — reglas de negocio deterministas (Investigación §3.1, «Prueba prioritaria»).
 * Sin base de datos: las mismas funciones que usa la API.
 */
import {
  AFFINITY_CAPS, AFFINITY_MAX_RAW, AFFINITY_POINTS_V3, BackingTier, CredentialCheckStatus,
  CredentialValidationStatus, DIMINISHING, ManualReviewStatus, ProjectBackingTier, ProjectStatus,
  RegistrationStatus, TrajectoryLevel, ValidationStatus, diminishingFactor, ActivityOrigin,
} from '@perfil/shared';
import { activityCvEligible, projectCvEligible, registrationLevel } from '../../../src/trajectory/cv-eligibility.rules';
import { decideProjectBacking } from '../../../src/projects/project-backing.rules';
import { projectReadiness } from '../../../src/projects/project-readiness.rules';
import { deriveCredentialValidationStatus, hostMatches } from '../../../src/validation/credential-check.rules';

describe('Afinidad: lo declarado no suma', () => {
  it('intereses, preferencias y habilidades declaradas tienen tope 0 (un área de mejora no incrementa la afinidad)', () => {
    expect(AFFINITY_CAPS.PREFERENCE + AFFINITY_CAPS.INTEREST + AFFINITY_CAPS.SKILL).toBe(0);
  });
  it('solo suman actividades, proyectos y credenciales, con topes 25/50/25 sobre 100', () => {
    expect([AFFINITY_CAPS.ACTIVITY, AFFINITY_CAPS.PROJECT, AFFINITY_CAPS.CERTIFICATE]).toEqual([25, 50, 25]);
    expect(AFFINITY_CAPS.ACTIVITY + AFFINITY_CAPS.PROJECT + AFFINITY_CAPS.CERTIFICATE).toBe(AFFINITY_MAX_RAW);
  });
  it('un proyecto DECLARED o FLAGGED vale 0', () => {
    expect(AFFINITY_POINTS_V3.PROJECT_DECLARED).toBe(0);
    expect(AFFINITY_POINTS_V3.PROJECT_FLAGGED).toBe(0);
  });
  it('rendimiento decreciente: repetir lo mismo vale cada vez menos', () => {
    expect([0, 1, 2, 3].map((i) => diminishingFactor(DIMINISHING.ACTIVITY, i))).toEqual([1, 0.7, 0.5, 0.3]);
  });
});

describe('Actividades: solo CONFIRMED es experiencia', () => {
  it.each([RegistrationStatus.INTERESTED, RegistrationStatus.REGISTERED, RegistrationStatus.ACCEPTED])(
    '%s no cuenta como experiencia confirmada',
    (estado) => {
      expect(registrationLevel(estado)).toBe(TrajectoryLevel.INCOMPLETE);
      expect(activityCvEligible(estado, ActivityOrigin.INTERNAL)).toBe(false);
    },
  );
  it('CONFIRMED actualiza la trayectoria como corroborada y es elegible para el currículo', () => {
    expect(registrationLevel(RegistrationStatus.CONFIRMED)).toBe(TrajectoryLevel.CORROBORATED);
    expect(activityCvEligible(RegistrationStatus.CONFIRMED, ActivityOrigin.INTERNAL)).toBe(true);
  });
});

describe('Proyectos: respaldo y requisitos', () => {
  const base = {
    repositoryAccessible: true, technicalCorroborations: 0, demoAccessible: false,
    confirmedMembers: 0, evidenceCount: 0, feedbackCount: 0, problems: [] as string[],
  };
  it('una captura no es fuente independiente: queda SUPPORTED', () => {
    expect(decideProjectBacking({ ...base, technicalCorroborations: 1, evidenceCount: 3 })).toBe(ProjectBackingTier.SUPPORTED);
  });
  it('señal técnica + otra persona que confirma: CORROBORATED; el repo ajeno no se atribuye', () => {
    expect(decideProjectBacking({ ...base, technicalCorroborations: 1, confirmedMembers: 1 })).toBe(ProjectBackingTier.CORROBORATED);
    expect(decideProjectBacking({ ...base, technicalCorroborations: 1, confirmedMembers: 1, attributionContested: true }))
      .toBe(ProjectBackingTier.SUPPORTED);
  });
  it('un borrador no es elegible para el currículo', () => {
    expect(projectCvEligible(ProjectStatus.DRAFT, ProjectBackingTier.CORROBORATED)).toBe(false);
  });
  it('para activar: cada área necesita una tecnología, y se nombra la que falta', () => {
    const r = projectReadiness({
      title: 'Proyecto', areaCount: 2, skillCount: 1, areasWithoutSkill: ['Redes'],
      repositoryUrl: 'https://github.com/a/b', repositoryCheck: null, members: [], pendingInvitations: 0,
      ownContributionConfirmed: true, evidenceCount: 1, demoCheck: null,
    });
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.code)).toEqual(['skill_per_area']);
    expect(r.missing[0].message).toMatch(/Redes/);
  });
});

describe('Credenciales: estado de validación', () => {
  const base = {
    job: ValidationStatus.COMPLETED, check: CredentialCheckStatus.NO_VERIFIER, contradictions: [] as string[],
    openBadge: null, manualReview: null, backing: BackingTier.SUPPORTED,
  };
  it('proveedor caído: INCONCLUSIVE, nunca REJECTED', () => {
    expect(deriveCredentialValidationStatus({ ...base, check: CredentialCheckStatus.UNREACHABLE })).toBe(CredentialValidationStatus.INCONCLUSIVE);
  });
  it('revisión manual sin prueba externa: INCONCLUSIVE', () => {
    expect(deriveCredentialValidationStatus({ ...base, manualReview: ManualReviewStatus.INCONCLUSIVE })).toBe(CredentialValidationStatus.INCONCLUSIVE);
  });
  it('los dominios oficiales no se comparan por subcadena', () => {
    expect(hostMatches('www.credly.com', 'credly.com')).toBe(true);
    expect(hostMatches('evilcredly.com', 'credly.com')).toBe(false);
  });
});
