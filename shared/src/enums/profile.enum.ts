export enum ProfileStatus {
  INCOMPLETE = 'incomplete',
  ACTIVE = 'active',
  UPDATED = 'updated',
}

/**
 * Autoevaluacion de una habilidad (especificacion §21.1).
 *
 * Tres niveles, no una escala numerica: pedir "del 1 al 5" invita a una
 * precision que una autoevaluacion no tiene. Y sea cual sea el valor, esto
 * sigue siendo *autodeclarado*; la experiencia respaldada por proyectos,
 * actividades o certificados se muestra aparte (§21.2).
 */
export enum SkillLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export const SKILL_LEVELS: readonly SkillLevel[] = [
  SkillLevel.BASIC,
  SkillLevel.INTERMEDIATE,
  SkillLevel.ADVANCED,
];

/**
 * Disponibilidad declarada para colaborar (§17.2).
 *
 * Es una senal para la formacion de equipos, no un compromiso contractual.
 */
export enum AvailabilityStatus {
  /** Busca activamente sumarse a algo. */
  LOOKING = 'looking',
  /** Escucha propuestas, sin buscar. */
  OPEN = 'open',
  /** Sin margen por ahora. */
  BUSY = 'busy',
  /** Prefiere no declararlo. Es el valor por defecto. */
  UNSPECIFIED = 'unspecified',
}

/** Modo de trabajo preferido, parte de `collaboration_preferences` (§17.2). */
export enum CollaborationMode {
  REMOTE = 'remote',
  IN_PERSON = 'in_person',
  HYBRID = 'hybrid',
}

/** Tipo de colaboracion que le interesa. */
export enum CollaborationInterest {
  PROJECTS = 'projects',
  RESEARCH = 'research',
  COMPETITIONS = 'competitions',
  STUDY_GROUPS = 'study_groups',
  VOLUNTEERING = 'volunteering',
}

/**
 * Campos que el estudiante puede decidir mostrar en su perfil compartible
 * (§44).
 *
 * La lista es cerrada a proposito: el estudiante elige dentro de los limites
 * del sistema, no fija los limites. Lo que nunca es publicable —correo
 * institucional, archivos privados, identificadores internos— simplemente no
 * tiene clave aqui, de modo que no hay configuracion capaz de exponerlo.
 */
export enum PublicProfileField {
  BIO = 'bio',
  AREAS = 'areas',
  AFFINITIES = 'affinities',
  SUPPORT_LEVEL = 'support_level',
  PROJECTS = 'projects',
  SKILLS = 'skills',
  AVAILABILITY = 'availability',
  TRAJECTORY = 'trajectory',
}

export const PUBLIC_PROFILE_FIELDS: readonly PublicProfileField[] = [
  PublicProfileField.BIO,
  PublicProfileField.AREAS,
  PublicProfileField.AFFINITIES,
  PublicProfileField.SUPPORT_LEVEL,
  PublicProfileField.PROJECTS,
  PublicProfileField.SKILLS,
  PublicProfileField.AVAILABILITY,
  PublicProfileField.TRAJECTORY,
];

/**
 * Configuracion de visibilidad por defecto.
 *
 * Todo en `false`: compartir es una decision explicita del estudiante, no algo
 * que ocurra por no haber mirado la pantalla de privacidad. El nombre no
 * aparece aqui porque un perfil sin nombre no identifica a nadie; es lo unico
 * que se muestra siempre cuando el perfil compartible esta activo.
 */
export const DEFAULT_PUBLIC_VISIBILITY: Record<PublicProfileField, boolean> = {
  [PublicProfileField.BIO]: false,
  [PublicProfileField.AREAS]: false,
  [PublicProfileField.AFFINITIES]: false,
  [PublicProfileField.SUPPORT_LEVEL]: false,
  [PublicProfileField.PROJECTS]: false,
  [PublicProfileField.SKILLS]: false,
  [PublicProfileField.AVAILABILITY]: false,
  [PublicProfileField.TRAJECTORY]: false,
};
