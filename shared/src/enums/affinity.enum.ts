/**
 * Nivel de afinidad de un estudiante con un area academica (RF17).
 *
 * Es una lectura cualitativa del puntaje calculado por el motor. RN-15 obliga
 * a leerlo como orientacion: no es una nota, no mide rendimiento y no sirve
 * para decisiones academicas formales.
 */
export enum AffinityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Familia de senal que alimenta el motor de afinidad (RN-14).
 *
 * RN-14 enumera las fuentes que el calculo debe considerar: intereses
 * declarados, participacion en actividades, proyectos, evidencias,
 * certificados externos y areas academicas relacionadas. Cada contribucion
 * al puntaje se clasifica en una de estas familias para que el estudiante
 * pueda ver de donde sale su afinidad.
 */
export enum AffinitySignalType {
  /** Interes declarado por el propio estudiante en su perfil. */
  INTEREST = 'interest',
  /** Habilidad declarada; pondera segun el nivel indicado. */
  SKILL = 'skill',
  /** Area en la que el estudiante declaro querer mejorar. */
  IMPROVEMENT_AREA = 'improvement_area',
  /** Interes, inscripcion o participacion confirmada en una actividad. */
  ACTIVITY = 'activity',
  /** Proyecto del portafolio, propio o como integrante aceptado. */
  PROJECT = 'project',
  /** Evidencia academica cargada por el estudiante. */
  EVIDENCE = 'evidence',
  /** Certificado externo adjuntado al perfil. */
  CERTIFICATE = 'certificate',
  /** Constancia interna emitida por el director de carrera. */
  CONSTANCY = 'constancy',
}

/**
 * Codigo de ponderacion configurable del motor (RN-14).
 *
 * RN-14 exige que el calculo use "mecanismos de ponderacion definidos para el
 * sistema". Cada codigo es una fila de `affinity_weights`: el motor lee sus
 * puntos desde la base, no desde el codigo fuente, de modo que la regla
 * aplicada queda registrada y es auditable.
 *
 * Una familia de senal puede tener varios codigos cuando el peso depende del
 * detalle: una habilidad pondera segun su nivel y una actividad segun si el
 * estudiante solo mostro interes, se inscribio o participo de forma
 * confirmada.
 */
export enum AffinityWeightCode {
  INTEREST = 'interest',
  /**
   * Interes segun la prioridad que le dio el estudiante (§51.1).
   *
   * Sustituyen a `INTEREST`, que valia lo mismo para todas. Que alguien ponga
   * un area en primer lugar y otra en quinto es informacion, y tratarlas igual
   * era desperdiciarla.
   */
  INTEREST_PRIORITY_1 = 'interest_priority_1',
  INTEREST_PRIORITY_2 = 'interest_priority_2',
  INTEREST_PRIORITY_3 = 'interest_priority_3',
  INTEREST_PRIORITY_4 = 'interest_priority_4',
  INTEREST_PRIORITY_5 = 'interest_priority_5',
  IMPROVEMENT_AREA = 'improvement_area',
  SKILL_BASIC = 'skill_basic',
  SKILL_INTERMEDIATE = 'skill_intermediate',
  SKILL_ADVANCED = 'skill_advanced',
  ACTIVITY_INTERESTED = 'activity_interested',
  ACTIVITY_REGISTERED = 'activity_registered',
  ACTIVITY_CONFIRMED = 'activity_confirmed',
  PROJECT_OWNED = 'project_owned',
  PROJECT_MEMBER = 'project_member',
  /**
   * Proyecto segun su nivel de respaldo (§51.3).
   *
   * Sustituyen a `PROJECT_OWNED`/`PROJECT_MEMBER`, que puntuaban igual un
   * proyecto con repositorio publico y revision docente que uno del que solo
   * existe su descripcion. Ser el autor ya no vale mas que ser integrante: lo
   * que vale es lo que se puede comprobar.
   */
  PROJECT_DECLARED = 'project_declared',
  PROJECT_SUPPORTED = 'project_supported',
  PROJECT_CORROBORATED = 'project_corroborated',
  PROJECT_REVIEWED = 'project_reviewed',
  PROJECT_FLAGGED = 'project_flagged',
  EVIDENCE = 'evidence',
  CERTIFICATE = 'certificate',
  /** Certificado externo segun lo que el validador pudo corroborar (§51.4). */
  CERTIFICATE_DECLARED = 'certificate_declared',
  CERTIFICATE_SUPPORTED = 'certificate_supported',
  CERTIFICATE_CORROBORATED = 'certificate_corroborated',
  CONSTANCY = 'constancy',
}

/**
 * Como se determino que una senal corresponde a un area academica (RN-14).
 *
 * RN-14 habla de "reglas, etiquetas, puntuaciones y coincidencias". Este campo
 * distingue cuando el area vino declarada de cuando el sistema la dedujo, para
 * que la explicacion que ve el estudiante sea honesta sobre su procedencia.
 */
export enum AffinityMatchType {
  /** El area estaba declarada de forma explicita en el registro de origen. */
  DECLARED = 'declared',
  /** Coincidencia entre las tecnologias del proyecto y las etiquetas del area. */
  TAG = 'tag',
  /** Coincidencia de texto con el nombre o las etiquetas del area. */
  TEXT = 'text',
  /** Heredada del proyecto o de la actividad que respalda el registro. */
  INHERITED = 'inherited',
}

/**
 * Resultado de una ejecucion del motor de afinidad (RF17).
 *
 * RF17 define un camino de fallo explicito: "informar que todavia no existe
 * informacion suficiente o que no fue posible realizar el calculo". Por eso el
 * calculo distingue entre haber producido afinidades y no tener todavia datos
 * con que trabajar; no son lo mismo y la interfaz debe decirlo distinto.
 */
export enum AffinityCalculationStatus {
  /** Se produjeron afinidades a partir de la informacion disponible. */
  CALCULATED = 'calculated',
  /** El perfil aun no reune senales suficientes para orientar. */
  INSUFFICIENT_DATA = 'insufficient_data',
}
