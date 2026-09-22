/**
 * Tipo de recomendacion academica (RF18, RN-16).
 *
 * RN-16 enumera lo que una recomendacion puede incluir: "actividades,
 * oportunidades o enlaces a cursos externos, recursos, areas de fortalecimiento
 * y posibles companeros de equipo". Cada valor corresponde exactamente a uno de
 * esos elementos; no se agrega ningun tipo que el documento no nombre.
 */
export enum RecommendationType {
  /** Actividad academica o extracurricular abierta en la plataforma. */
  ACTIVITY = 'activity',
  /** Convocatoria, reto o hackathon: una oportunidad, normalmente con plazo. */
  OPPORTUNITY = 'opportunity',
  /** Curso de una plataforma o institucion externa, con su enlace. */
  EXTERNAL_COURSE = 'external_course',
  /** Recurso de apoyo: guia, documentacion o material de consulta. */
  RESOURCE = 'resource',
  /** Area academica en la que conviene fortalecerse. */
  STRENGTHENING_AREA = 'strengthening_area',
  /** Otro estudiante con quien podria formar equipo. */
  TEAMMATE = 'teammate',
}

/**
 * Estado de una recomendacion desde el punto de vista del estudiante (RN-16).
 *
 * RN-16: "las recomendaciones no seran obligatorias y el estudiante conservara
 * la decision sobre su utilizacion". El estado es donde esa decision queda
 * registrada. El diagrama de clases del documento ya modela la operacion
 * markAsViewed() sobre Recommendation.
 */
export enum RecommendationStatus {
  /** Generada y todavia no abierta. */
  NEW = 'new',
  /** El estudiante abrio su detalle. */
  VIEWED = 'viewed',
  /** El estudiante la guardo para tenerla en cuenta. */
  SAVED = 'saved',
  /** El estudiante indico que no le interesa: no vuelve a proponerse. */
  DISMISSED = 'dismissed',
}

/**
 * Motivo por el que se genero una recomendacion.
 *
 * Se guarda junto a la recomendacion para poder responder "por que me
 * recomiendan esto", del mismo modo que el motor de afinidad explica cada
 * puntaje con su desglose. Una recomendacion sin motivo no se muestra.
 */
export enum RecommendationReasonCode {
  /** El elemento pertenece a un area en la que el estudiante tiene afinidad. */
  AFFINITY_AREA = 'affinity_area',
  /** El elemento pertenece a un area de preferencia declarada. */
  PREFERRED_AREA = 'preferred_area',
  /** El elemento pertenece a un area en la que el estudiante quiere mejorar. */
  IMPROVEMENT_AREA = 'improvement_area',
  /** Coincidencia de texto con un interes declarado en texto libre. */
  FREE_INTEREST_MATCH = 'free_interest_match',
  /** Coincidencia con una habilidad declarada. */
  SKILL_MATCH = 'skill_match',
  /** Companero con afinidad en las mismas areas. */
  SHARED_AFFINITY = 'shared_affinity',
  /** Companero fuerte justo donde el estudiante tiene poca trayectoria. */
  COMPLEMENTARY_PROFILE = 'complementary_profile',
  /** Actividad u oportunidad con fecha proxima. */
  UPCOMING_DATE = 'upcoming_date',
  /** Area de interes o mejora con poca trayectoria registrada todavia. */
  LOW_TRAJECTORY = 'low_trajectory',
  /**
   * §59, primer regimen: hay afinidad pero poco respaldo.
   *
   * Es la situacion de quien sabe hacia donde va y todavia no puede
   * demostrarlo. Lo que necesita es practica, no mas teoria.
   */
  BUILD_EXPERIENCE = 'build_experience',
  /**
   * §59, segundo regimen: afinidad con respaldo ya construido.
   *
   * Recomendarle una introduccion a quien ya tiene tres proyectos corroborados
   * en el area es hacerle perder el tiempo.
   */
  ADVANCE_LEVEL = 'advance_level',
  /** El respaldo del area es bajo: la senal que dispara el primer regimen. */
  LOW_SUPPORT = 'low_support',
  /** Companero que cubre una habilidad que el estudiante no declara (§62). */
  MISSING_SKILL = 'missing_skill',
  /** Companero con respaldo trazable en el area compartida (§62). */
  SUPPORT_BACKED = 'support_backed',
  /** Disponibilidad declarada para colaborar (§58, §62). */
  AVAILABILITY = 'availability',
  /** El elemento encaja con el contexto del estudiante: modalidad, semestre. */
  CONTEXT_MATCH = 'context_match',
}

/**
 * Resultado de pedir recomendaciones (RF18, Tabla 2.27).
 *
 * La Tabla 2.27 separa dos fallos que no son lo mismo y que la interfaz debe
 * decir distinto:
 *  - 2a. el perfil no tiene informacion suficiente para generar recomendaciones:
 *        al estudiante se le puede pedir que complete su perfil;
 *  - 3a. hay informacion, pero ningun elemento disponible se relaciona con el
 *        perfil: no hay nada que pedirle, simplemente no hay oferta relacionada
 *        en este momento.
 */
export enum RecommendationOutcome {
  AVAILABLE = 'available',
  INSUFFICIENT_PROFILE = 'insufficient_profile',
  NO_MATCHES = 'no_matches',
}
