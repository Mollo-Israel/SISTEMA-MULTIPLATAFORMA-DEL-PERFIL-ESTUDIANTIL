/**
 * Cuestionario Inicial de Orientación Académica (especificacion §16).
 *
 * Orienta preferencias; no evalua conocimiento. Por eso sus resultados son
 * *sugerencias* que el estudiante confirma, y nunca alimentan la afinidad por
 * si solos: lo que alimenta afinidad son los intereses que el estudiante
 * decide incorporar, no lo que el cuestionario dedujo.
 */
export enum OnboardingRunStatus {
  /** Respondido; sus areas sugeridas esperan confirmacion. */
  COMPLETED = 'completed',
  /** El estudiante ya eligio que areas incorporar. Cerrado. */
  CONFIRMED = 'confirmed',
  /** Sustituido por una ejecucion posterior. El cuestionario puede repetirse. */
  SUPERSEDED = 'superseded',
}

/** Forma de respuesta de cada pregunta (§16). */
export enum OnboardingQuestionType {
  SINGLE = 'single',
  MULTIPLE = 'multiple',
}

/**
 * De donde salio un interes (§18).
 *
 * Distinguirlos permite responder algo que el estudiante preguntara tarde o
 * temprano: por que aparece esta area en mi perfil.
 */
export enum InterestSource {
  /** Sugerido por el cuestionario y confirmado por el estudiante. */
  ONBOARDING = 'onboarding',
  /** Elegido directamente del catalogo. */
  MANUAL = 'manual',
}
