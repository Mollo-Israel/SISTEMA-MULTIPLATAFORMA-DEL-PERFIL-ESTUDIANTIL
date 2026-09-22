/**
 * Gamificación (especificación §66).
 *
 * §66 abre con la frase que lo gobierna todo: **es independiente de la
 * afinidad**, y nunca `puntos → afinidad`. Son dos sistemas que miran cosas
 * distintas. La afinidad dice hacia dónde se inclina alguien y cuánto lo
 * sostiene; los puntos reconocen que hizo algo. Un estudiante con muchos puntos
 * no tiene por eso más afinidad con nada, y el motor de afinidad no lee esta
 * tabla por ningún camino.
 */

/**
 * Hechos que §66 admite premiar.
 *
 * La lista es cerrada y es literalmente la de §66. Lo que **no** está aquí lo
 * dice la misma sección sin ambigüedad: nada de intereses, autodeclaraciones,
 * mensajes, archivos repetidos ni proyectos vacíos. Todos esos son cosas que
 * uno declara o acumula; ninguno es algo que haya hecho.
 */
export enum GamificationTrigger {
  /** Participación confirmada por el responsable de la actividad (§23). */
  PARTICIPACION_CONFIRMADA = 'participacion_confirmada',
  /** El primer proyecto que alcanza respaldo: deja de ser solo una declaración. */
  PRIMER_PROYECTO_RESPALDADO = 'primer_proyecto_respaldado',
  /** Un proyecto llega a corroborado o revisado (§36). */
  PROYECTO_CORROBORADO = 'proyecto_corroborado',
  /** Una colaboración aceptada: contacto, equipo o contribución confirmada. */
  COLABORACION_ACEPTADA = 'colaboracion_aceptada',
  /** Un hito de trayectoria: el respaldo de un área cruza un umbral (§54). */
  HITO_TRAYECTORIA = 'hito_trayectoria',

  // ------------------------------------------------------------------
  // Disparadores del 40 % que §66 excluye. Se conservan porque hay
  // criterios administrados que los referencian y borrarlos dejaría esas
  // filas sin sentido, pero ningún evento nuevo los usa.
  // ------------------------------------------------------------------
  /** @deprecated §66: un proyecto recién registrado es un proyecto vacío. */
  PROYECTO_REGISTRADO = 'proyecto_registrado',
  /** @deprecated §66: los archivos repetidos no son mérito. */
  EVIDENCIA_ADJUNTA = 'evidencia_adjunta',
  /** @deprecated §66: adjuntar un certificado es una autodeclaración. */
  CERTIFICADO_EXTERNO = 'certificado_externo',
  /** @deprecated El evento premiado es la participación, no la constancia (§55). */
  CONSTANCIA_INTERNA = 'constancia_interna',
  /** @deprecated §66: completar el perfil es autodeclararse. */
  PERFIL_COMPLETO = 'perfil_completo',
}

/** Disparadores vigentes, los únicos que generan eventos nuevos (§66). */
export const ACTIVE_GAMIFICATION_TRIGGERS: readonly GamificationTrigger[] = [
  GamificationTrigger.PARTICIPACION_CONFIRMADA,
  GamificationTrigger.PRIMER_PROYECTO_RESPALDADO,
  GamificationTrigger.PROYECTO_CORROBORADO,
  GamificationTrigger.COLABORACION_ACEPTADA,
  GamificationTrigger.HITO_TRAYECTORIA,
];

/** Puntos de cada acción. Son el reconocimiento, no una medida de nadie. */
export const GAMIFICATION_POINTS: Record<string, number> = {
  [GamificationTrigger.PARTICIPACION_CONFIRMADA]: 10,
  [GamificationTrigger.PRIMER_PROYECTO_RESPALDADO]: 25,
  [GamificationTrigger.PROYECTO_CORROBORADO]: 20,
  [GamificationTrigger.COLABORACION_ACEPTADA]: 8,
  [GamificationTrigger.HITO_TRAYECTORIA]: 15,
};

export const GAMIFICATION_TRIGGER_LABEL: Record<string, string> = {
  [GamificationTrigger.PARTICIPACION_CONFIRMADA]: 'Participación confirmada',
  [GamificationTrigger.PRIMER_PROYECTO_RESPALDADO]: 'Primer proyecto respaldado',
  [GamificationTrigger.PROYECTO_CORROBORADO]: 'Proyecto corroborado',
  [GamificationTrigger.COLABORACION_ACEPTADA]: 'Colaboración aceptada',
  [GamificationTrigger.HITO_TRAYECTORIA]: 'Hito de trayectoria',
};

/**
 * Insignias del sistema (§66, §73.8).
 *
 * Cada una reconoce una cantidad de un hecho concreto. Ninguna depende del
 * puntaje total: una insignia por acumular puntos premiaría acumular, y lo que
 * §66 quiere reconocer son cosas hechas.
 */
export enum BadgeCode {
  PRIMERA_PARTICIPACION = 'primera_participacion',
  CINCO_PARTICIPACIONES = 'cinco_participaciones',
  PRIMER_RESPALDO = 'primer_respaldo',
  TRES_PROYECTOS_CORROBORADOS = 'tres_proyectos_corroborados',
  PRIMERA_COLABORACION = 'primera_colaboracion',
  EQUIPO_FORMADO = 'equipo_formado',
  TRAYECTORIA_RESPALDADA = 'trayectoria_respaldada',
}

/** Secciones que el estudiante puede incluir en su resumen (§67). */
export enum TrajectorySection {
  BASIC = 'basic',
  BIO = 'bio',
  AREAS = 'areas',
  PROJECTS = 'projects',
  CONTRIBUTIONS = 'contributions',
  TECHNOLOGIES = 'technologies',
  ACTIVITIES = 'activities',
  CERTIFICATES = 'certificates',
  CONSTANCIES = 'constancies',
  EVIDENCES = 'evidences',
  AFFINITY = 'affinity',
  SUPPORT = 'support',
}

export const TRAJECTORY_SECTIONS: readonly TrajectorySection[] = [
  TrajectorySection.BASIC,
  TrajectorySection.BIO,
  TrajectorySection.AREAS,
  TrajectorySection.PROJECTS,
  TrajectorySection.CONTRIBUTIONS,
  TrajectorySection.TECHNOLOGIES,
  TrajectorySection.ACTIVITIES,
  TrajectorySection.CERTIFICATES,
  TrajectorySection.CONSTANCIES,
  TrajectorySection.EVIDENCES,
  TrajectorySection.AFFINITY,
  TrajectorySection.SUPPORT,
];

export const TRAJECTORY_SECTION_LABEL: Record<TrajectorySection, string> = {
  [TrajectorySection.BASIC]: 'Datos básicos',
  [TrajectorySection.BIO]: 'Presentación',
  [TrajectorySection.AREAS]: 'Áreas principales',
  [TrajectorySection.PROJECTS]: 'Proyectos',
  [TrajectorySection.CONTRIBUTIONS]: 'Rol y contribución',
  [TrajectorySection.TECHNOLOGIES]: 'Tecnologías',
  [TrajectorySection.ACTIVITIES]: 'Actividades confirmadas',
  [TrajectorySection.CERTIFICATES]: 'Certificados externos',
  [TrajectorySection.CONSTANCIES]: 'Constancias internas',
  [TrajectorySection.EVIDENCES]: 'Evidencias',
  [TrajectorySection.AFFINITY]: 'Afinidad',
  [TrajectorySection.SUPPORT]: 'Nivel de respaldo',
};

/**
 * Advertencia obligatoria del resumen (§67).
 *
 * Va en el propio documento, no en la pantalla desde la que se descarga: el PDF
 * circula solo, y quien lo reciba tiene que poder leer qué es y qué no es sin
 * haber visto nunca el sistema.
 */
export const TRAJECTORY_DISCLAIMER =
  'Documento generado a partir de información registrada en Afinia. '
  + 'No constituye historial académico oficial, certificación institucional '
  + 'ni acreditación profesional de competencias.';
