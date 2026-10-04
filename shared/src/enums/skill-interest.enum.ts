/**
 * Interés por una tecnología concreta (V2 §21, §22).
 *
 * Sustituye al nivel autodeclarado (BÁSICO/INTERMEDIO/AVANZADO). El
 * estudiante ya no dice «soy avanzado en React»; dice «me interesa React» o
 * «quiero mejorar PostgreSQL». Es un dato declarativo: alimenta
 * recomendaciones y colaboración, **nunca** la afinidad (§21, §45.1).
 */
export enum SkillInterestKind {
  /** «Me interesa». */
  INTEREST = 'interest',
  /** «Quiero mejorar». */
  IMPROVE = 'improve',
}

/** De dónde salió el interés (procedencia, V2 §5.4). */
export enum SkillInterestSource {
  /** Declarado por el estudiante. */
  DECLARED = 'declared',
  /** Sugerido por la orientación y confirmado por el estudiante. */
  ORIENTATION = 'orientation',
  /**
   * Migrado de la antigua autoevaluación de nivel (V2 §22, §82). Se conserva
   * como interés para no perder la preferencia, pero ya no dice nada de
   * competencia.
   */
  HISTORICAL_SELF_ASSESSMENT = 'historical_self_assessment',
}

export const SKILL_INTEREST_KIND_LABEL: Record<SkillInterestKind, string> = {
  [SkillInterestKind.INTEREST]: 'Me interesa',
  [SkillInterestKind.IMPROVE]: 'Quiero mejorar',
};

/**
 * Pasos de la bienvenida V2 (§20.1), en orden.
 *
 *   profile      — Paso 1: perfil base y confirmación de datos institucionales.
 *   interests    — Paso 2: áreas y tecnologías que le interesan.
 *   improvement  — Paso 3: áreas y tecnologías que quiere mejorar.
 *   availability — Paso 4: disponibilidad, colaboración y privacidad básica.
 *   questionnaire— Paso 5: orientación académica, opcional.
 */
export const ONBOARDING_STEPS_V2 = [
  'welcome',
  'profile',
  'interests',
  'improvement',
  'availability',
  'questionnaire',
  'done',
] as const;

export type OnboardingStepV2 = (typeof ONBOARDING_STEPS_V2)[number];
