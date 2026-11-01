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
  /**
   * Un reto que un docente definió y reconoció a un estudiante de su alcance.
   * Lo verifica una persona responsable: no es una autodeclaración. Sus puntos
   * los fija el propio reto.
   */
  RECONOCIMIENTO_DOCENTE = 'reconocimiento_docente',
  /**
   * V5 §10: un docente da fe, con sustento, de que el estudiante completó un
   * recurso. Abrirlo, descargarlo o guardarlo en favoritos no lo dispara.
   */
  RECURSO_COMPLETADO_ATESTIGUADO = 'recurso_completado_atestiguado',

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

/**
 * V5 §10: las tres familias que se premian. Son los únicos disparadores que
 * generan eventos nuevos y los únicos que un criterio nuevo puede usar:
 *
 * - ACTIVITY_PARTICIPATION_CONFIRMED → `participacion_confirmada`, al confirmar
 *   la asistencia (nunca por interés, solicitud ni admisión).
 * - PROJECT_TEACHER_RECOGNITION → `proyecto_corroborado`, que desde V4.1 solo
 *   llega por un reconocimiento docente motivado (no por el respaldo solo).
 * - RESOURCE_COMPLETION_ATTESTED → `recurso_completado_atestiguado`.
 *
 * Los demás quedan retirados: sus eventos pasados se conservan.
 */
export const V5_GAMIFICATION_FAMILY: Record<string, 'ACTIVITY_PARTICIPATION_CONFIRMED' | 'PROJECT_TEACHER_RECOGNITION' | 'RESOURCE_COMPLETION_ATTESTED'> = {
  participacion_confirmada: 'ACTIVITY_PARTICIPATION_CONFIRMED',
  proyecto_corroborado: 'PROJECT_TEACHER_RECOGNITION',
  recurso_completado_atestiguado: 'RESOURCE_COMPLETION_ATTESTED',
};

/** Disparadores vigentes, los únicos que generan eventos nuevos (V5 §10). */
export const ACTIVE_GAMIFICATION_TRIGGERS: readonly GamificationTrigger[] = [
  GamificationTrigger.PARTICIPACION_CONFIRMADA,
  GamificationTrigger.PROYECTO_CORROBORADO,
  GamificationTrigger.RECURSO_COMPLETADO_ATESTIGUADO,
];

/** Hechos que un criterio puede premiar (V5 §10: solo las tres familias). */
export const SYSTEM_GAMIFICATION_TRIGGERS: readonly GamificationTrigger[] = ACTIVE_GAMIFICATION_TRIGGERS;

/** Puntos de cada acción. Son el reconocimiento, no una medida de nadie. */
export const GAMIFICATION_POINTS: Record<string, number> = {
  [GamificationTrigger.PARTICIPACION_CONFIRMADA]: 10,
  [GamificationTrigger.PRIMER_PROYECTO_RESPALDADO]: 25,
  [GamificationTrigger.PROYECTO_CORROBORADO]: 20,
  [GamificationTrigger.COLABORACION_ACEPTADA]: 8,
  [GamificationTrigger.HITO_TRAYECTORIA]: 15,
  [GamificationTrigger.RECURSO_COMPLETADO_ATESTIGUADO]: 10,
};

export const GAMIFICATION_TRIGGER_LABEL: Record<string, string> = {
  [GamificationTrigger.PARTICIPACION_CONFIRMADA]: 'Participación confirmada',
  [GamificationTrigger.PRIMER_PROYECTO_RESPALDADO]: 'Primer proyecto respaldado',
  [GamificationTrigger.PROYECTO_CORROBORADO]: 'Proyecto reconocido por un docente',
  [GamificationTrigger.COLABORACION_ACEPTADA]: 'Colaboración aceptada',
  [GamificationTrigger.HITO_TRAYECTORIA]: 'Hito de trayectoria',
  [GamificationTrigger.RECONOCIMIENTO_DOCENTE]: 'Reto reconocido por un docente',
  [GamificationTrigger.RECURSO_COMPLETADO_ATESTIGUADO]: 'Recurso completado (atestiguado por un docente)',
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
  /** V2 §61.1: insignias obtenidas. */
  BADGES = 'badges',
  /** V3 §43.1: actividades internas, separadas por tipo. */
  ACADEMIC_ACTIVITIES = 'academic_activities',
  EXTRACURRICULAR_ACTIVITIES = 'extracurricular_activities',
  /** V2 §61.1: «contacto autorizado», los canales que el estudiante comparte. */
  CONTACT = 'contact',
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
  TrajectorySection.BADGES,
  TrajectorySection.CONTACT,
  TrajectorySection.ACADEMIC_ACTIVITIES,
  TrajectorySection.EXTRACURRICULAR_ACTIVITIES,
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
  [TrajectorySection.BADGES]: 'Insignias',
  [TrajectorySection.CONTACT]: 'Contacto',
  [TrajectorySection.ACADEMIC_ACTIVITIES]: 'Actividades académicas internas',
  [TrajectorySection.EXTRACURRICULAR_ACTIVITIES]: 'Actividades extracurriculares internas',
};

/**
 * V3 §43.1: paso 1 del currículo, en este orden. El paso 2 elige ítems
 * concretos dentro de las secciones de `CV_ITEM_SECTIONS`.
 */
export const CV_SECTIONS: readonly { key: TrajectorySection; label: string }[] = [
  { key: TrajectorySection.BIO, label: 'Perfil / resumen' },
  // V6 §10.4: cada sección dice qué es; participar no es tener un documento.
  { key: TrajectorySection.PROJECTS, label: 'Proyectos y aportes individuales (con nivel de respaldo)' },
  { key: TrajectorySection.ACADEMIC_ACTIVITIES, label: 'Participaciones académicas registradas (sin documento emitido)' },
  { key: TrajectorySection.EXTRACURRICULAR_ACTIVITIES, label: 'Participaciones extracurriculares registradas (sin documento emitido)' },
  { key: TrajectorySection.CERTIFICATES, label: 'Credenciales externas (emisor y consulta oficial)' },
  { key: TrajectorySection.CONSTANCIES, label: 'Certificados institucionales recibidos (emisor oficial)' },
  { key: TrajectorySection.TECHNOLOGIES, label: 'Habilidades respaldadas' },
  { key: TrajectorySection.BADGES, label: 'Insignias' },
  { key: TrajectorySection.CONTACT, label: 'Contacto' },
];

export const CV_ITEM_SECTIONS: readonly TrajectorySection[] = [
  TrajectorySection.PROJECTS,
  TrajectorySection.ACTIVITIES,
  TrajectorySection.ACADEMIC_ACTIVITIES,
  TrajectorySection.EXTRACURRICULAR_ACTIVITIES,
  TrajectorySection.CERTIFICATES,
  TrajectorySection.CONSTANCIES,
  TrajectorySection.TECHNOLOGIES,
  TrajectorySection.BADGES,
];

/** V3 §42: nivel de cada cosa de la trayectoria, en lenguaje natural. */
export enum TrajectoryLevel {
  DECLARED = 'declared',
  SUPPORTED = 'supported',
  CORROBORATED = 'corroborated',
  REVIEWED = 'reviewed',
  INCOMPLETE = 'incomplete',
}

export const TRAJECTORY_LEVEL_LABEL: Record<TrajectoryLevel, { label: string; explain: string }> = {
  [TrajectoryLevel.DECLARED]: { label: 'Declarado', explain: 'Lo registraste tú; todavía nada lo respalda.' },
  [TrajectoryLevel.SUPPORTED]: { label: 'Con respaldo', explain: 'Tiene al menos una fuente que lo apoya.' },
  [TrajectoryLevel.CORROBORATED]: { label: 'Corroborado', explain: 'Una fuente independiente lo confirma.' },
  [TrajectoryLevel.REVIEWED]: { label: 'Revisado', explain: 'Un docente o la Dirección lo revisó.' },
  [TrajectoryLevel.INCOMPLETE]: { label: 'Inconcluso', explain: 'Le falta un paso para contar.' },
};

/**
 * Plantillas del CV (V2 §61.2): pocas, estáticas y mantenibles. No es un
 * diseñador libre: cambian tipografía, color de acento y densidad, no qué se
 * afirma.
 */
export enum CvTemplate {
  CLASSIC = 'classic',
  MODERN = 'modern',
  COMPACT = 'compact',
}

export const CV_TEMPLATES: readonly { key: CvTemplate; label: string; description: string }[] = [
  { key: CvTemplate.CLASSIC, label: 'Clásica', description: 'Sobria, en blanco y negro, con secciones amplias.' },
  { key: CvTemplate.MODERN, label: 'Moderna', description: 'Títulos en el color de la carrera y líneas de separación.' },
  { key: CvTemplate.COMPACT, label: 'Compacta', description: 'Tipografía con serifa y menos espacio: más contenido por página.' },
];

/** Largo máximo de la presentación escrita o asistida para el CV. */
export const CV_SUMMARY_MAX = 1200;

/**
 * Advertencia obligatoria del resumen (§67).
 *
 * Va en el propio documento, no en la pantalla desde la que se descarga: el PDF
 * circula solo, y quien lo reciba tiene que poder leer qué es y qué no es sin
 * haber visto nunca el sistema.
 */
/**
 * V5 ND-02 y §15.2: cómo leer lo que el resumen incluye. Va aparte del
 * descargo, que es el texto exacto de la especificación (§61.4).
 */
export const TRAJECTORY_SOURCES_NOTICE =
  'Las participaciones figuran como asistencia registrada por el responsable de cada actividad; '
  + 'no son constancias emitidas por Afinia y se incluyen solo en este resumen informativo. '
  + 'En las credenciales externas, Afinia informa el resultado de la consulta al proveedor en la fecha indicada; no las certifica.';

/** V6 §10.4: el texto del resumen, tal cual. */
export const TRAJECTORY_DISCLAIMER =
  'Resumen de trayectoria estudiantil — selección de experiencias registradas en Afinia. '
  + 'La fuente y nivel de respaldo de cada entrada se muestran de forma individual. '
  + 'No constituye certificación institucional ni acreditación profesional.';

/**
 * V6 §10.2: qué significa cada estado de respaldo, en una sola lista que usan
 * la trayectoria, los proyectos y las credenciales. Ninguno es un certificado.
 */
export const BACKING_STATES_EXPLAINED: readonly { state: string; label: string; meaning: string }[] = [
  { state: 'declared', label: 'Declarado', meaning: 'Lo registraste; no tenemos una señal comprobable suficiente.' },
  { state: 'supported', label: 'Con respaldo', meaning: 'Hay una fuente consultable, un documento o una señal parcial (por ejemplo, el documento se leyó y coincide, o el repositorio muestra la tecnología), sin una verificación individual concluyente. No es tener un certificado.' },
  { state: 'corroborated', label: 'Corroborado', meaning: 'Se contrastó una señal concreta con una fuente según las reglas: el emisor oficial identificó la credencial, o el repositorio y la demo respondieron.' },
  { state: 'reviewed', label: 'Revisado', meaning: 'Una persona identificada (un docente) lo revisó; se indica qué revisó. No es una certificación profesional.' },
  { state: 'inconclusive', label: 'Inconcluso', meaning: 'No se pudo determinar más por falta o indisponibilidad de la prueba (por ejemplo, el emisor no respondió). No es una sospecha de fraude.' },
  { state: 'flagged', label: 'Observado', meaning: 'Algo no coincide; tiene un motivo y se puede corregir para volver a comprobarlo.' },
];
