import { createHash } from 'crypto';
import {
  AffinityLevel,
  HANDS_ON_RESOURCE_TYPES,
  LearningResourceType,
  RecommendationType,
} from '@perfil/shared';

/**
 * Reglas del motor de recomendaciones (§58 a §62, RF18, RN-16).
 *
 * El puntaje de un elemento es un porcentaje de 0 a 100 repartido exactamente
 * como manda §60. Eso es un cambio de fondo respecto a la version anterior, que
 * sumaba puntos sueltos sin techo: dos recomendaciones de 7 y 9 puntos no
 * decian nada sobre cuanto encaja cada una, solo cual iba antes.
 *
 * El puntaje ordena la lista y nada mas. No es una nota ni una evaluacion:
 * RN-15 y las condiciones de la Tabla 2.27 lo excluyen.
 */
export const RULES = {
  /**
   * §60 · Reparto del ranking inicial. Suma 100.
   *
   * Los cuatro pesos son literalmente los de la especificacion. Estan aqui como
   * porcentajes y no como puntos sueltos para que cualquiera pueda comprobar
   * que suman 100 y que ninguna señal pesa mas de lo que §60 le concede.
   */
  ranking: {
    /** V3 §34 · 40 % intereses explícitos (áreas declaradas y texto libre). */
    explicitInterest: 40,
    /** V3 §34 · 30 % áreas de mejora. */
    improvementArea: 30,
    /** V3 §34 · 15 % tecnologías de interés o a mejorar. */
    skills: 15,
    /** V3 §34 · 10 % orientación confirmada. */
    orientation: 10,
    /** V3 §34 · 5 % feedback de recomendaciones (guardó algo parecido). */
    feedback: 5,
  },

  /**
   * V3 §34.1 · «No me interesa». Cada recomendación parecida descartada (misma
   * área y mismo tipo) multiplica la prioridad por este factor. No modifica
   * los intereses del perfil: eso se hace en Mi perfil → Intereses.
   */
  dismissal: { factor: 0.6 },

  /**
   * Cuanto cuenta un interes explicito segun la prioridad que le dio (§51.1).
   *
   * La prioridad 1 cuenta entera; la 5 cuenta algo mas de la mitad. No baja mas
   * porque seguir siendo un interes declarado ya es una señal fuerte: el
   * estudiante lo eligio de una lista, no le salio por descarte.
   */
  interestByPriority: [1, 0.9, 0.8, 0.7, 0.6],

  /**
   * Un interes escrito en texto libre o una habilidad declarada tambien son
   * interes, pero deducido por coincidencia de texto. Pesan menos porque la
   * coincidencia puede equivocarse; una prioridad declarada no.
   */
  freeInterestFactor: 0.5,
  /** La actividad o el recurso declaran la tecnología (vínculo directo). */
  skillLinkFactor: 0.6,
  /** La tecnología aparece en el texto (coincidencia, puede equivocarse). */
  skillMatchFactor: 0.4,

  /**
   * §60 · El 10 % de «disponibilidad/contexto», repartido.
   *
   * Cada parte responde a algo comprobable, no a una impresion: si ocurre
   * pronto, si va dirigida a su semestre, si la modalidad coincide con como
   * dijo que prefiere colaborar y si declaro estar disponible.
   */
  context: {
    upcomingDate: 0.4,
    semesterScope: 0.3,
    modality: 0.2,
    availability: 0.1,
  },
  upcomingWindowDays: 30,

  /** Puntaje minimo, sobre 100, para que un elemento llegue a recomendarse. */
  minElementScore: 10,

  /**
   * §59 · Refuerzo por regimen.
   *
   * §60 llama a su reparto «ranking **inicial**», y §59 es lo que viene
   * despues: ante la misma afinidad, lo que conviene recomendar cambia segun se
   * pueda o no demostrar esa afinidad. El refuerzo no penaliza a nadie -un
   * elemento que no encaja con el regimen simplemente no lo recibe-, de modo
   * que nada desaparece de la lista por esto; solo cambia el orden.
   */
  regime: {
    bonus: 15,
    /** Cuantas areas del estudiante se consideran «donde se inclina». */
    topAreas: 3,
  },

  strengthening: {
    improvementPoints: 5,
    /** Sin afinidad registrada en el area. */
    noTrajectoryPoints: 3,
    /** Afinidad baja en el area. */
    lowTrajectoryPoints: 2,
    /** El respaldo del area es bajo pese a haber afinidad (§59). */
    lowSupportPoints: 4,
  },

  /**
   * §62 · Prioridades para sugerir un companero, en el orden que las enumera.
   *
   * «Habilidades faltantes» va primero y vale mas que compartir area: un equipo
   * se forma por lo que le falta, no por lo que ya tiene repetido.
   */
  teammate: {
    /** Cubre una habilidad que el estudiante no declara, en un area que le importa. */
    missingSkillPoints: 5,
    maxMissingSkills: 3,
    /** Tiene respaldo trazable en un area compartida. */
    supportBackedPoints: 4,
    /** Area fuerte en comun. */
    sharedAreaPoints: 3,
    maxSharedAreas: 3,
    /** Esta por delante justo donde el estudiante quiere fortalecerse. */
    complementaryPoints: 4,
    maxComplementaryAreas: 2,
    /** Declaro que busca equipo o que escucha propuestas. */
    availabilityPoints: 2,
    minScore: 3,
    /**
     * Cuantas areas de cada perfil se consideran «sus mas fuertes» (§52).
     *
     * Antes esto era el nivel: «media o alta». Con el motor V2 el nivel es
     * absoluto y comparable en el tiempo, lo cual es correcto para orientar
     * pero inservible como filtro relativo: un estudiante de tercer semestre
     * no tiene ningun area por encima de 25 sobre 100, y la regla vieja lo
     * dejaba sin companeros sugeridos justo cuando mas le sirven.
     */
    topAreas: 3,
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
// §59 · Los dos regimenes
// ---------------------------------------------------------------------------

/**
 * Que conviene recomendarle a alguien en un area, segun lo que ya tiene.
 *
 * §59 distingue dos situaciones que piden cosas opuestas:
 *
 *   - afinidad alta y respaldo bajo: sabe hacia donde va y todavia no puede
 *     demostrarlo. Necesita practica, proyectos y material con el que construir
 *     experiencia;
 *   - afinidad alta y respaldo alto: ya lo demostro. Recomendarle una
 *     introduccion seria hacerle perder el tiempo; lo que corresponde son
 *     retos, convocatorias y colaboracion.
 */
export enum RecommendationRegime {
  /** Hay hacia donde, falta con que demostrarlo. */
  BUILD_EXPERIENCE = 'build_experience',
  /** Ya esta demostrado: toca subir el nivel. */
  ADVANCE = 'advance',
  /** El area no es de las fuertes del estudiante: no aplica ningun regimen. */
  NONE = 'none',
}

/**
 * Categorias de actividad con las que se construye experiencia demostrable
 * (§59, primer regimen).
 *
 * El criterio es si de participar sale algo que pueda respaldarse despues: de
 * un taller o un hackathon sale un producto; de una charla, no.
 */
export const HANDS_ON_CATEGORIES = [
  'taller_academico',
  'hackathon',
  'reto',
  'club_estudio',
  'investigacion',
  'responsabilidad_social',
  'actividad_sociedad_cientifica',
];

/**
 * Categorias que llevan mas lejos a quien ya tiene respaldo (§59, segundo
 * regimen): retos, convocatorias e investigacion.
 */
export const ADVANCED_CATEGORIES = ['hackathon', 'reto', 'convocatoria', 'investigacion'];

/** Si un elemento encaja con el regimen del area a la que pertenece. */
export function fitsRegime(
  regime: RecommendationRegime,
  categoryCode: string | null | undefined,
  resourceType: LearningResourceType | null,
  type: RecommendationType,
): boolean {
  if (regime === RecommendationRegime.NONE) return false;

  if (regime === RecommendationRegime.BUILD_EXPERIENCE) {
    if (resourceType) return HANDS_ON_RESOURCE_TYPES.includes(resourceType);
    return !!categoryCode && HANDS_ON_CATEGORIES.includes(categoryCode);
  }

  // ADVANCE: retos, oportunidades y colaboracion.
  if (type === RecommendationType.OPPORTUNITY) return true;
  if (resourceType) return resourceType === LearningResourceType.PRACTICE;
  return !!categoryCode && ADVANCED_CATEGORIES.includes(categoryCode);
}

// ---------------------------------------------------------------------------
// Clasificacion de actividades por categoria del catalogo (RF4)
// ---------------------------------------------------------------------------

/**
 * Categorias que dejaron de tratarse como actividades (§61).
 *
 * Un recurso no tiene fecha, ni cupo, ni inscripcion, ni participacion que
 * confirmar. Desde el BATCH 7 viven en `learning_resources`, que es el catalogo
 * controlado que pide §61. Estas categorias se excluyen del reparto de
 * actividades para no recomendar dos veces lo mismo por dos caminos.
 */
export const CATALOGUED_AS_RESOURCE_CATEGORIES = [
  'curso_externo_recomendado',
  'recurso_de_apoyo',
];

/** Categorias que el documento trata como oportunidades: llamados con plazo. */
export const OPPORTUNITY_CATEGORIES = ['convocatoria', 'hackathon', 'reto'];

export function typeForCategory(code: string | null | undefined): RecommendationType {
  if (code && OPPORTUNITY_CATEGORIES.includes(code)) return RecommendationType.OPPORTUNITY;
  return RecommendationType.ACTIVITY;
}

/** A que grupo de la pantalla pertenece un recurso del catalogo (§61). */
export function typeForResource(resourceType: LearningResourceType): RecommendationType {
  return resourceType === LearningResourceType.EXTERNAL_COURSE
    ? RecommendationType.EXTERNAL_COURSE
    : RecommendationType.RESOURCE;
}

/** Tipos que apuntan a un elemento concreto y no a un area o una persona. */
export const ELEMENT_TYPES: RecommendationType[] = [
  RecommendationType.ACTIVITY,
  RecommendationType.OPPORTUNITY,
  RecommendationType.EXTERNAL_COURSE,
  RecommendationType.RESOURCE,
];

/** Tipos que apuntan a una actividad de la plataforma. */
export const ACTIVITY_BACKED_TYPES: RecommendationType[] = [
  RecommendationType.ACTIVITY,
  RecommendationType.OPPORTUNITY,
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

export const SUPPORT_LABEL: Record<AffinityLevel, string> = {
  high: 'alto',
  medium: 'medio',
  low: 'bajo',
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

/**
 * Palabras significativas de un texto, sin repetir.
 *
 * Los numeros sueltos no cuentan. Un año, un codigo o un identificador que
 * aparezca a la vez en un interes y en el titulo de una actividad no dice nada
 * sobre si esa actividad le interesa a nadie, y dejarlo pasar produce
 * coincidencias que no se pueden explicar a quien pregunte por que se le
 * recomendo algo.
 */
export function significantTokens(text: string, minLength: number): string[] {
  return [
    ...new Set(
      normalize(text)
        .split(' ')
        .filter((t) => t.length >= minLength && !STOPWORDS.has(t) && !/^\d+$/.test(t)),
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
