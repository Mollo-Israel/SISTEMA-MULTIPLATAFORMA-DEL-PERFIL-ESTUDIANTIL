import { createHash } from 'crypto';
import { AffinityLevel, RecommendationType } from '@perfil/shared';

/**
 * Reglas del modulo de recomendaciones (RF18, RN-16).
 *
 * El alcance del documento dice que la recomendacion "se apoyara en reglas,
 * etiquetas, coincidencias y los resultados del motor de afinidad". Estas son
 * esas reglas, escritas en un solo lugar. Cada punto que suma una
 * recomendacion sale de aqui y queda registrado como un motivo legible, de
 * modo que el puntaje de una recomendacion es exactamente la suma de sus
 * motivos.
 *
 * El puntaje solo ordena la lista. No es una nota ni una evaluacion: RN-15 y
 * las condiciones posteriores de la Tabla 2.27 lo excluyen.
 */
export const RULES = {
  /** Area del elemento donde el estudiante tiene afinidad, segun su nivel. */
  affinityPoints: { high: 6, medium: 4, low: 2 } as Record<AffinityLevel, number>,
  /** Area de preferencia declarada: base mas la prioridad (1 a 5). */
  preferredAreaBase: 1,
  /** Area en la que el estudiante declaro querer mejorar. */
  improvementAreaPoints: 4,
  /** Coincidencia de texto con un interes declarado en texto libre. */
  freeInterestPoints: 3,
  /** Coincidencia de texto con una habilidad declarada. */
  skillMatchPoints: 2,
  /** Refuerzo por fecha proxima. Nunca basta por si solo para recomendar. */
  upcomingDatePoints: 1,
  upcomingWindowDays: 30,
  /** Puntaje minimo para recomendar una actividad, curso, recurso u oportunidad. */
  minElementScore: 2,

  strengthening: {
    improvementPoints: 5,
    /** Sin afinidad registrada en el area. */
    noTrajectoryPoints: 3,
    /** Afinidad baja en el area. */
    lowTrajectoryPoints: 2,
  },

  teammate: {
    /** Area donde ambos tienen afinidad media o alta. */
    sharedAreaPoints: 3,
    maxSharedAreas: 3,
    /** Area donde el companero tiene afinidad alta y el estudiante quiere fortalecerse. */
    complementaryPoints: 4,
    maxComplementaryAreas: 2,
    minScore: 3,
  },

  /** Cuantas recomendaciones de cada tipo se muestran como maximo. */
  limits: {
    [RecommendationType.ACTIVITY]: 8,
    [RecommendationType.OPPORTUNITY]: 5,
    [RecommendationType.EXTERNAL_COURSE]: 5,
    [RecommendationType.RESOURCE]: 5,
    [RecommendationType.STRENGTHENING_AREA]: 3,
    [RecommendationType.TEAMMATE]: 5,
  } as Record<RecommendationType, number>,
};

/**
 * Huella de las reglas vigentes. Si una regla cambia, cambia la huella, y una
 * recomendacion guardada puede distinguirse de una generada con otras reglas.
 */
export const RULES_VERSION = createHash('sha256')
  .update(JSON.stringify(RULES))
  .digest('hex')
  .slice(0, 16);

// ---------------------------------------------------------------------------
// Clasificacion de actividades por categoria del catalogo (RF4)
// ---------------------------------------------------------------------------

export const EXTERNAL_COURSE_CATEGORY = 'curso_externo_recomendado';
export const RESOURCE_CATEGORY = 'recurso_de_apoyo';
/** Categorias que el documento trata como oportunidades: llamados con plazo. */
export const OPPORTUNITY_CATEGORIES = ['convocatoria', 'hackathon', 'reto'];

export function typeForCategory(code: string | null | undefined): RecommendationType {
  if (code === EXTERNAL_COURSE_CATEGORY) return RecommendationType.EXTERNAL_COURSE;
  if (code === RESOURCE_CATEGORY) return RecommendationType.RESOURCE;
  if (code && OPPORTUNITY_CATEGORIES.includes(code)) return RecommendationType.OPPORTUNITY;
  return RecommendationType.ACTIVITY;
}

/** Tipos que apuntan a una actividad de la plataforma. */
export const ELEMENT_TYPES: RecommendationType[] = [
  RecommendationType.ACTIVITY,
  RecommendationType.OPPORTUNITY,
  RecommendationType.EXTERNAL_COURSE,
  RecommendationType.RESOURCE,
];

/** Orden y nombre de los grupos, tal como los enumera RN-16. */
export const TYPE_ORDER: { type: RecommendationType; label: string }[] = [
  { type: RecommendationType.ACTIVITY, label: 'Actividades' },
  { type: RecommendationType.OPPORTUNITY, label: 'Oportunidades' },
  { type: RecommendationType.EXTERNAL_COURSE, label: 'Cursos externos' },
  { type: RecommendationType.RESOURCE, label: 'Recursos de apoyo' },
  { type: RecommendationType.STRENGTHENING_AREA, label: 'Áreas de fortalecimiento' },
  { type: RecommendationType.TEAMMATE, label: 'Posibles compañeros de equipo' },
];

export const TYPE_LABEL = Object.fromEntries(
  TYPE_ORDER.map((t) => [t.type, t.label]),
) as Record<RecommendationType, string>;

export const LEVEL_LABEL: Record<AffinityLevel, string> = {
  high: 'alta',
  medium: 'media',
  low: 'baja',
};

// ---------------------------------------------------------------------------
// Coincidencias de texto (RN-14 y alcance: "etiquetas, coincidencias")
// ---------------------------------------------------------------------------

/**
 * Palabras que no aportan coincidencia. Incluye las genericas del idioma y las
 * que aparecen en casi todas las actividades de la carrera: si "sistemas" o
 * "ingenieria" contaran, cualquier interes coincidiria con todo.
 */
const STOPWORDS = new Set([
  'para', 'con', 'del', 'las', 'los', 'una', 'uno', 'que', 'por', 'sobre', 'como', 'entre',
  'desde', 'hasta', 'este', 'esta', 'estos', 'estas', 'sus', 'mas',
  'desarrollo', 'ingenieria', 'sistemas', 'informaticos', 'estudiantes', 'estudiante',
  'carrera', 'actividad', 'actividades', 'curso', 'cursos', 'externo', 'recurso', 'apoyo',
  'taller', 'guia', 'oficial', 'introduccion', 'fundamentos', 'basico', 'basica',
  'avanzado', 'avanzada', 'aplicada', 'aplicado', 'aplicaciones', 'administracion',
]);

/** Minusculas, sin tildes y con cualquier signo convertido en espacio. */
export function normalize(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Palabras significativas de un texto, sin repetir. */
export function significantTokens(text: string, minLength: number): string[] {
  return [
    ...new Set(
      normalize(text)
        .split(' ')
        .filter((t) => t.length >= minLength && !STOPWORDS.has(t)),
    ),
  ];
}

/** Coincidencia por palabra completa, nunca por fragmento de palabra. */
export function containsTerm(normalizedHaystack: string, normalizedTerm: string): boolean {
  if (!normalizedTerm) return false;
  return ` ${normalizedHaystack} `.includes(` ${normalizedTerm} `);
}

/**
 * Un termino declarado por el estudiante coincide con un texto si aparece la
 * frase completa, o si aparece alguna de sus palabras significativas.
 */
export function matchesDeclaredTerm(
  normalizedHaystack: string,
  declared: string,
  minTokenLength: number,
): boolean {
  const phrase = normalize(declared);
  if (phrase.length >= minTokenLength && containsTerm(normalizedHaystack, phrase)) return true;
  return significantTokens(declared, minTokenLength).some((t) =>
    containsTerm(normalizedHaystack, t),
  );
}
