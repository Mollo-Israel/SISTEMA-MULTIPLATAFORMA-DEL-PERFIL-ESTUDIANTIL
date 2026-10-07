import { LinkCheckStatus } from '@perfil/shared';

/**
 * Requisitos para que un proyecto pase a ACTIVE (V3 §22).
 *
 * Un DRAFT puede guardarse incompleto; un ACTIVE es experiencia que aparece
 * en la trayectoria, así que exige lo mínimo para ser creíble:
 *
 *   título · ≥1 área · ≥1 skill · repositorio público y válido ·
 *   integrantes confirmados si es grupal · contribución propia confirmada ·
 *   evidencia visual/contextual mínima (o demo accesible).
 *
 * Reglas puras: el servicio reúne los datos y esto decide.
 */

export type ReadinessCode =
  | 'title'
  | 'area'
  | 'skill'
  | 'repository'
  | 'repository_invalid'
  | 'repository_not_public'
  | 'members_pending'
  | 'members_unconfirmed'
  | 'own_contribution'
  | 'evidence';

export const READINESS_MESSAGE: Record<ReadinessCode, string> = {
  title: 'Ponle un título de al menos 3 caracteres.',
  area: 'Elige al menos un área.',
  skill: 'Elige al menos una tecnología del catálogo.',
  repository: 'Agrega el enlace al repositorio.',
  repository_invalid: 'El enlace no es de un repositorio (GitHub, GitLab o Bitbucket: usuario/repositorio).',
  repository_not_public: 'El repositorio no existe o no es público.',
  members_pending: 'Hay invitaciones sin responder: espera a que las acepten o cancélalas.',
  members_unconfirmed: 'Todos los integrantes deben confirmar su contribución.',
  own_contribution: 'Confirma tu propia contribución.',
  evidence: 'Agrega una evidencia del funcionamiento (captura, documentación o presentación) o una demo accesible.',
};

export interface ReadinessInput {
  title: string;
  areaCount: number;
  skillCount: number;
  repositoryUrl: string | null;
  /** Estado de la comprobación del repositorio; `null` si nunca se comprobó. */
  repositoryCheck: LinkCheckStatus | null;
  /** Integrantes aceptados, sin contar al responsable. */
  members: { confirmed: boolean }[];
  pendingInvitations: number;
  ownContributionConfirmed: boolean;
  evidenceCount: number;
  demoCheck: LinkCheckStatus | null;
}

export interface Readiness {
  ready: boolean;
  missing: { code: ReadinessCode; message: string }[];
  /** Avisos que no bloquean: el repositorio no pudo comprobarse (cuota, caída). */
  warnings: string[];
}

const REPO = /^https?:\/\/(www\.)?(github\.com|gitlab\.com|bitbucket\.org)\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?\/?$/i;

export function isRepositoryUrl(url: string): boolean {
  return REPO.test(url.trim());
}

export function projectReadiness(i: ReadinessInput): Readiness {
  const missing: ReadinessCode[] = [];
  const warnings: string[] = [];

  if (!i.title || i.title.trim().length < 3) missing.push('title');
  if (i.areaCount < 1) missing.push('area');
  if (i.skillCount < 1) missing.push('skill');

  if (!i.repositoryUrl) {
    missing.push('repository');
  } else if (!isRepositoryUrl(i.repositoryUrl)) {
    missing.push('repository_invalid');
  } else if (i.repositoryCheck === LinkCheckStatus.UNAVAILABLE || i.repositoryCheck === LinkCheckStatus.BLOCKED) {
    missing.push('repository_not_public');
  } else if (i.repositoryCheck !== LinkCheckStatus.AVAILABLE) {
    // §20 aplicado al repositorio: si no se pudo comprobar (cuota agotada,
    // GitHub caído, verificación apagada) no se inventa que no existe.
    warnings.push('No se pudo comprobar el repositorio ahora; se volverá a intentar.');
  }

  if (i.pendingInvitations > 0) missing.push('members_pending');
  if (i.members.some((m) => !m.confirmed)) missing.push('members_unconfirmed');
  if (!i.ownContributionConfirmed) missing.push('own_contribution');

  const demoAccesible = i.demoCheck === LinkCheckStatus.AVAILABLE;
  if (i.evidenceCount < 1 && !demoAccesible) missing.push('evidence');

  return {
    ready: missing.length === 0,
    missing: missing.map((code) => ({ code, message: READINESS_MESSAGE[code] })),
    warnings,
  };
}
