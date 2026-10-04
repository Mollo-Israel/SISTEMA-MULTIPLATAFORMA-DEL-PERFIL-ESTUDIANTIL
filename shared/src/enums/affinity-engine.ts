/**
 * Motor de Afinidad V3 — reglas de cálculo (Especificación Maestra V2, §45 a §52).
 *
 * V3 cambia la pregunta: ya no es «hacia dónde se inclina el estudiante» sino
 * «qué tan relacionada está su trayectoria RESPALDADA con esta área» (§45.1).
 * Por eso lo declarado —intereses, orientación, áreas de mejora,
 * disponibilidad, tecnologías de interés— ya **no** suma afinidad: alimenta
 * recomendaciones. Solo puntúan participaciones confirmadas, proyectos con
 * respaldo y certificados con respaldo (§46). Las cifras de V2 se conservan en
 * las instantáneas con `engine_version = 2`.
 *
 * Este archivo es la **regla**, no el resultado. Vive en `shared` a propósito:
 * el estudiante tiene derecho a ver con qué se le calculó, y la pantalla de
 * afinidad (§91) muestra exactamente estas cifras sin volver a escribirlas.
 *
 * ## Por qué una parte en la base y otra aquí
 *
 * §51 admite dos caminos: almacenar/versionar los pesos o centralizarlos en la
 * configuración del motor. Se hacen los dos, cada uno donde sirve:
 *
 * - Los **puntos base** de cada señal viven en `affinity_weights`. Son lo único
 *   que un director podría querer ajustar, y ahí quedan registrados y
 *   auditables sin volver a desplegar.
 * - La **estructura** —topes, rendimientos decrecientes, normalización,
 *   umbrales— vive aquí. No es un parámetro: cambiarla cambia el significado
 *   del número, y eso debe pasar por una versión del motor, no por un UPDATE.
 *
 * El motor no usa aprendizaje automático (§48): es determinista, versionado y
 * explicable. Dos ejecuciones con los mismos datos dan el mismo resultado.
 */

/** Versión del motor que produjo un cálculo (§56). */
export const AFFINITY_ENGINE_VERSION = 3;

/**
 * Familia de señal para el respaldo y la regla de diversidad (§53, §54).
 *
 * No es lo mismo que `AffinitySignalType`: aquella dice *qué tipo de registro*
 * originó la señal; esta dice *de qué clase de prueba* se trata, que es lo que
 * §54 mira para decidir si un respaldo alto está sostenido por más de una cosa.
 */
export enum AffinitySignalFamily {
  /** Lo que el estudiante declara de sí mismo: intereses y habilidades. */
  PREFERENCE = 'preference',
  /** Participación confirmada en actividades institucionales. */
  ACTIVITY = 'activity',
  /** Proyectos del portafolio, propios o como integrante confirmado. */
  PROJECT = 'project',
  /** Certificados emitidos por terceros ajenos a la universidad. */
  EXTERNAL_CERTIFICATE = 'external_certificate',
  /** Un actor académico —docente o dirección— dejó constancia del trabajo. */
  ACADEMIC_REVIEW = 'academic_review',
  /** Trazabilidad que no encaja en las anteriores y no está ya contada. */
  OTHER = 'other',
}

/**
 * Familias que §54 considera independientes entre sí.
 *
 * `PREFERENCE` y `OTHER` quedan fuera: lo que uno declara de sí mismo no
 * respalda nada, y «otros» es por definición un cajón heterogéneo.
 */
export const INDEPENDENT_SUPPORT_FAMILIES: readonly AffinitySignalFamily[] = [
  AffinitySignalFamily.ACTIVITY,
  AffinitySignalFamily.PROJECT,
  AffinitySignalFamily.EXTERNAL_CERTIFICATE,
  AffinitySignalFamily.ACADEMIC_REVIEW,
];

/** Registro concreto del que salió una contribución (§56). */
export enum AffinitySourceEntityType {
  STUDENT_INTEREST = 'student_interest',
  STUDENT_SKILL = 'student_skill',
  IMPROVEMENT_AREA = 'improvement_area',
  ACTIVITY_REGISTRATION = 'activity_registration',
  PROJECT = 'project',
  EXTERNAL_CERTIFICATE = 'external_certificate',
  PROJECT_EVIDENCE = 'project_evidence',
  ACTIVITY_EVIDENCE = 'activity_evidence',
  INTERNAL_CONSTANCY = 'internal_constancy',
  PROJECT_FEEDBACK = 'project_feedback',
}

/**
 * Rendimientos decrecientes (§51.2, §51.3, §51.4).
 *
 * La segunda actividad confirmada de un área enseña menos que la primera. No
 * es una penalización: es que la información nueva que aporta una repetición
 * es menor. El último valor se aplica a todo lo que venga después.
 *
 * El orden importa y es deterministo: las señales se ordenan de mayor a menor
 * puntaje base antes de aplicar la escala, de modo que el multiplicador del
 * 100 % le toca siempre a la señal más fuerte. Si dependiera del orden de
 * inserción, dos estudiantes con los mismos datos podrían obtener números
 * distintos.
 */
export const DIMINISHING = {
  /** §51.2 — actividades. */
  ACTIVITY: [1, 0.7, 0.5, 0.3] as const,
  /** §51.3 y §51.4 — proyectos y certificados. */
  PROJECT: [1, 0.75, 0.5, 0.25] as const,
} as const;

/** Multiplicador que corresponde a la enésima señal (0 indexado). */
export function diminishingFactor(scale: readonly number[], index: number): number {
  return scale[Math.min(index, scale.length - 1)];
}

/**
 * Topes por familia y área (§51).
 *
 * Existen para que ninguna familia pueda dominar un área por acumulación. Un
 * estudiante con quince certificados de un curso de fin de semana no tiene más
 * afinidad que uno con tres: tiene más certificados.
 */
export const AFFINITY_CAPS = {
  /** V3 §45.1: lo declarado ya no suma afinidad. */
  PREFERENCE: 0,
  INTEREST: 0,
  SKILL: 0,
  /** V3 §47.1 */
  ACTIVITY: 25,
  /** V3 §47.2 */
  PROJECT: 50,
  /** V3 §47.3 */
  CERTIFICATE: 25,
} as const;

/**
 * Puntos base de afinidad V3 (§47). Son la escala del motor: viven aquí y en
 * `affinity_weights`, que una migración alinea con estos valores.
 */
export const AFFINITY_POINTS_V3 = {
  ACTIVITY_CONFIRMED: 10,
  PROJECT_DECLARED: 0,
  PROJECT_SUPPORTED: 10,
  PROJECT_CORROBORATED: 18,
  PROJECT_REVIEWED: 22,
  PROJECT_FLAGGED: 0,
  CERTIFICATE_DECLARED: 0,
  CERTIFICATE_SUPPORTED: 8,
  CERTIFICATE_CORROBORATED: 15,
} as const;

/**
 * Máximo directo de afinidad por área (V3 §47): 25 + 50 + 25 = 100.
 *
 * `AFFINITY_SCORE = round(min(100, actividades + proyectos + certificados))`.
 * No se compara contra el área más fuerte del propio estudiante (§47.4).
 */
export const AFFINITY_MAX_RAW = 100;

/** Topes de respaldo por familia (§53). Suman exactamente 100. */
export const SUPPORT_CAPS = {
  /** §53.1 */
  ACTIVITY: 20,
  /** §53.2 */
  PROJECT: 45,
  /** §53.3 */
  CERTIFICATE: 25,
  /** §53.4 */
  OTHER: 10,
} as const;

/** Puntos de respaldo (§53). No son configurables en base: son la escala. */
export const SUPPORT_POINTS = {
  /** §53.1 — cada participación confirmada. */
  ACTIVITY_CONFIRMED: 8,
  /**
   * §53.1 — una constancia interna refuerza el **mismo** evento.
   *
   * No crea un segundo evento de afinidad (§55): la participación ya se contó
   * una vez. Lo que la constancia añade es trazabilidad, no experiencia.
   */
  CONSTANCY: 4,
  /** §53.2 — por proyecto, según su nivel de respaldo. */
  PROJECT_DECLARED: 0,
  PROJECT_SUPPORTED: 8,
  PROJECT_CORROBORATED: 15,
  PROJECT_REVIEWED: 20,
  PROJECT_FLAGGED: 0,
  /** §53.3 — por certificado, según su nivel de respaldo. */
  CERTIFICATE_DECLARED: 0,
  CERTIFICATE_SUPPORTED: 8,
  CERTIFICATE_CORROBORATED: 15,
  /** §53.4 — señales de trazabilidad todavía no contadas. */
  ACADEMIC_REVIEW: 5,
  ACTIVITY_EVIDENCE: 3,
  STANDALONE_CONSTANCY: 4,
} as const;

/**
 * Umbrales de nivel (§54).
 *
 * §54 los define para el respaldo. Se usan también para la afinidad porque
 * ahora ambos puntajes viven en la misma escala de 0 a 100 y tener dos tablas
 * de cortes distintas solo confundiría a quien lee la pantalla.
 */
export const LEVEL_THRESHOLDS = {
  /** 0–24 */
  LOW_MAX: 24,
  /** 25–59 */
  MEDIUM_MAX: 59,
  /** 60–100 */
} as const;

/**
 * Señales que §50 excluye del cálculo de afinidad.
 *
 * Se listan para poder explicarlas: la pantalla (§91) no solo dice qué suma,
 * también dice qué se tuvo en cuenta y **no** sumó, que es la mitad de la
 * explicación y la que suele faltar.
 */
export const AFFINITY_EXCLUDED_REASON: Record<string, string> = {
  interest:
    'Interés declarado: orienta tus recomendaciones, pero no suma afinidad (V2 §45.1).',
  improvement_area:
    'Área en la que quieres mejorar: orienta tus recomendaciones, pero no suma afinidad (V2 §45.1).',
  project_without_skills:
    'Confirma en el proyecto las tecnologías que usaste: así sabemos a qué áreas pertenece tu experiencia (V2 §48).',
  activity_interested:
    'Interés en una actividad: marcar interés es una intención, no una experiencia (§23).',
  activity_registered:
    'Inscripción sin participación confirmada: inscribirse tampoco es haber participado (§23).',
  constancy:
    'Constancia interna: respalda la participación que ya se contó, no la vuelve a contar (§55).',
  evidence:
    'Evidencia de proyecto: mejora el respaldo del proyecto, no crea un proyecto más (§55).',
};
