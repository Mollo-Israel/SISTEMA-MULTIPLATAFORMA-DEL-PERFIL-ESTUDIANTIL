import { ProjectBackingTier, ProjectSkillEvidenceStatus, TechnologyStatus } from '@perfil/shared';

/**
 * Respaldo de un proyecto (V3 §28). Reglas puras.
 *
 *   DECLARED     — sin repositorio accesible: no hay respaldo técnico suficiente.
 *   SUPPORTED    — repositorio válido + al menos una señal técnica o contextual.
 *   CORROBORATED — repositorio accesible
 *                  + ≥1 corroboración técnica relevante (lenguaje o manifiesto
 *                    que respalda una tecnología declarada)
 *                  + ≥1 señal independiente (demo accesible, integrantes que
 *                    confirmaron su contribución o evidencia contextual).
 *   REVIEWED     — SUPPORTED o CORROBORATED con retroalimentación docente.
 *                  No es aprobación académica oficial.
 *   FLAGGED      — contradicción importante. No suma mientras siga así.
 */
export interface ProjectBackingInput {
  repositoryAccessible: boolean;
  /** Tecnologías declaradas que el repositorio respalda (lenguaje o manifiesto). */
  technicalCorroborations: number;
  demoAccessible: boolean;
  /** Integrantes (sin el responsable) que confirmaron su contribución. */
  confirmedMembers: number;
  evidenceCount: number;
  feedbackCount: number;
  problems: string[];
}

export function decideProjectBacking(i: ProjectBackingInput): ProjectBackingTier {
  if (i.problems.length > 0) return ProjectBackingTier.FLAGGED;
  if (!i.repositoryAccessible) return ProjectBackingTier.DECLARED;

  const independiente = i.demoAccessible || i.confirmedMembers > 0 || i.evidenceCount > 0;
  let tier: ProjectBackingTier = ProjectBackingTier.DECLARED;
  if (i.technicalCorroborations > 0 || independiente) tier = ProjectBackingTier.SUPPORTED;
  if (i.technicalCorroborations > 0 && independiente) tier = ProjectBackingTier.CORROBORATED;
  if (tier !== ProjectBackingTier.DECLARED && i.feedbackCount > 0) tier = ProjectBackingTier.REVIEWED;
  return tier;
}

/**
 * Estado de cada tecnología declarada según la última comprobación (§24.4).
 *
 * La revisión académica se conserva cuando el repositorio no la respalda:
 * GitHub no sabe nada de lo que el docente comprobó.
 */
export function skillEvidenceFromSignal(
  signal: { status: TechnologyStatus; source: string | null } | undefined,
  academicReviewed: boolean,
): { status: ProjectSkillEvidenceStatus; source: string | null } {
  if (signal?.status === TechnologyStatus.BOTH) {
    return signal.source === 'languages'
      ? { status: ProjectSkillEvidenceStatus.CORROBORATED_BY_GITHUB_LANGUAGE, source: 'languages' }
      : { status: ProjectSkillEvidenceStatus.CORROBORATED_BY_MANIFEST, source: signal.source };
  }
  if (academicReviewed) return { status: ProjectSkillEvidenceStatus.CORROBORATED_BY_ACADEMIC_REVIEW, source: 'revisión docente' };
  return { status: ProjectSkillEvidenceStatus.DECLARED, source: null };
}

/** Corroboración técnica (§28): solo lenguaje o manifiesto, no la revisión académica. */
export const TECHNICAL_EVIDENCE: readonly ProjectSkillEvidenceStatus[] = [
  ProjectSkillEvidenceStatus.CORROBORATED_BY_GITHUB_LANGUAGE,
  ProjectSkillEvidenceStatus.CORROBORATED_BY_MANIFEST,
];
