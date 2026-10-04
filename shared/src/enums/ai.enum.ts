/**
 * Asistente de IA (especificación V2 §43).
 *
 * La IA interpreta y sugiere; las reglas deterministas de Afinia deciden
 * (§5.3). Nada de lo que devuelve cambia afinidad, respaldo, aprobaciones,
 * participación ni constancias: una sugerencia solo tiene efecto cuando una
 * persona autorizada la acepta y la guarda por el camino normal.
 */

export enum AiProvider {
  NONE = 'none',
  OPENAI_COMPATIBLE = 'openai_compatible',
}

/** Tareas permitidas (§43.2). Fuera de esta lista la IA no se usa. */
export enum AiTaskType {
  TAG_SUGGESTION = 'TAG_SUGGESTION',
  EVIDENCE_SUMMARY = 'EVIDENCE_SUMMARY',
  INCONSISTENCY_EXPLANATION = 'INCONSISTENCY_EXPLANATION',
  CV_TEXT_ASSIST = 'CV_TEXT_ASSIST',
  ANALYTICS_NARRATIVE = 'ANALYTICS_NARRATIVE',
  CONTENT_MODERATION_FLAG = 'CONTENT_MODERATION_FLAG',
}

export enum AiRunStatus {
  COMPLETED = 'completed',
  /** El proveedor no respondió, tardó demasiado o devolvió algo inservible. */
  FAILED = 'failed',
}

export const AI_TASK_LABEL: Record<AiTaskType, string> = {
  [AiTaskType.TAG_SUGGESTION]: 'Sugerencia de etiquetas',
  [AiTaskType.EVIDENCE_SUMMARY]: 'Resumen de evidencias',
  [AiTaskType.INCONSISTENCY_EXPLANATION]: 'Explicación de inconsistencias',
  [AiTaskType.CV_TEXT_ASSIST]: 'Ayuda de redacción del CV',
  [AiTaskType.ANALYTICS_NARRATIVE]: 'Narrativa de tendencias',
  [AiTaskType.CONTENT_MODERATION_FLAG]: 'Moderación de contenido',
};

/** Modos de la ayuda de redacción del CV (§61.3). */
export enum CvAssistMode {
  IMPROVE = 'improve',
  SUMMARIZE = 'summarize',
  REORGANIZE = 'reorganize',
  ALTERNATIVES = 'alternatives',
}

/** Estado del nombre de un equipo (§44). */
export enum TeamNameStatus {
  OK = 'ok',
  /** La IA lo marcó como ambiguo: no se comparte hasta corregirlo. */
  FLAGGED = 'flagged',
}
