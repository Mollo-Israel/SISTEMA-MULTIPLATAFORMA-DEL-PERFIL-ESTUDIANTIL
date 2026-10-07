/**
 * Colaboración entre estudiantes (especificación §42 a §47, §73.6).
 *
 * Todo lo de aquí comparte una regla: **nada ocurre sin consentimiento**. Un QR
 * no crea un contacto (§45), una sugerencia no envía una invitación (§47) y una
 * conversación solo existe entre quienes ya aceptaron tratarse (§42).
 */

/** Estado de una solicitud de contacto (§45). */
export enum ContactRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  /** Quien la envió se arrepintió antes de que la respondieran. */
  CANCELLED = 'cancelled',
}

/**
 * Cómo se conocieron.
 *
 * Sirve para explicar de dónde salió un contacto, no para puntuar a nadie.
 */
export enum ContactSource {
  /** Escaneó su QR (§43, §45). */
  QR = 'qr',
  /** Lo encontró entre las sugerencias de compañeros (§62). */
  SUGGESTION = 'suggestion',
  /** Lo buscó por su cuenta. */
  DIRECTORY = 'directory',
}

/** Situación de una necesidad de equipo (§46). */
export enum TeamNeedStatus {
  /** Busca integrantes. */
  OPEN = 'open',
  /** Ya no busca: se cubrió o se abandonó. */
  CLOSED = 'closed',
}

/** Disponibilidad que una necesidad pide de sus integrantes (§46). */
export enum AvailabilityRequirement {
  /** Cualquiera sirve. */
  ANY = 'any',
  /** Quien escuche propuestas o esté buscando. */
  OPEN_OR_LOOKING = 'open_or_looking',
  /** Solo quien declaró estar buscando activamente. */
  LOOKING = 'looking',
}

/** Situación de un equipo (§46). */
export enum TeamStatus {
  FORMING = 'forming',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

/** Estado de una postulación a una necesidad de equipo (V3 §31, §55). */
export enum TeamApplicationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  /** El propio estudiante la retiró; puede volver a postular. */
  WITHDRAWN = 'withdrawn',
}

/**
 * Motivos de rechazo predefinidos (V3 §55): sin texto libre innecesario.
 * «Otro motivo» exige un comentario breve; en los demás es opcional.
 */
export const TEAM_APPLICATION_REJECTION_REASONS = [
  { code: 'skills_not_matching', label: 'Buscamos otras habilidades' },
  { code: 'team_full', label: 'El equipo ya está completo' },
  { code: 'schedule', label: 'La disponibilidad no coincide' },
  { code: 'chose_other_profile', label: 'Elegimos otro perfil para este cupo' },
  { code: 'other', label: 'Otro motivo' },
] as const;

export type TeamApplicationRejectionReason = (typeof TEAM_APPLICATION_REJECTION_REASONS)[number]['code'];

/** Estado de una invitación a un equipo (§47). */
export enum TeamInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
}

/**
 * Clase de conversación del chat **retirado** (V2 §57).
 *
 * Solo la usa la entidad de las conversaciones históricas, que se conservan
 * sin acceso funcional. No se crean conversaciones nuevas.
 */
export enum ConversationKind {
  DIRECT = 'direct',
  TEAM = 'team',
}

/**
 * Factores de la sugerencia de integrantes (§47).
 *
 * La ponderación es la que fija la especificación. Se expone junto a cada
 * sugerencia porque §47 cierra con «la recomendación debe explicar razones».
 */
export const TEAM_SUGGESTION_WEIGHTS = {
  /** Cuánto de lo que falta cubre esta persona. */
  SKILL_COVERAGE: 50,
  /** Afinidad con el área o el proyecto del que trata la necesidad. */
  CONTEXT_AFFINITY: 20,
  /** Disponibilidad declarada. */
  AVAILABILITY: 15,
  /** Respaldo de trayectoria relacionado. */
  SUPPORT: 15,
} as const;

/** Por qué se sugiere a alguien para un equipo (§47, §93). */
export enum TeamSuggestionReason {
  SKILL_COVERAGE = 'skill_coverage',
  CONTEXT_AFFINITY = 'context_affinity',
  AVAILABILITY = 'availability',
  SUPPORT_BACKED = 'support_backed',
  /** Ya está en el equipo o cubre algo que el equipo ya tiene. */
  ALREADY_COVERED = 'already_covered',
}

export const TEAM_SUGGESTION_REASON_LABEL: Record<TeamSuggestionReason, string> = {
  [TeamSuggestionReason.SKILL_COVERAGE]: 'Cubre habilidades que faltan',
  [TeamSuggestionReason.CONTEXT_AFFINITY]: 'Tiene afinidad con el área del equipo',
  [TeamSuggestionReason.AVAILABILITY]: 'Declaró disponibilidad',
  [TeamSuggestionReason.SUPPORT_BACKED]: 'Su trayectoria en el área está respaldada',
  [TeamSuggestionReason.ALREADY_COVERED]: 'El equipo ya cubre lo que aporta',
};

/** Longitud del identificador público opaco (§43). */
export const PUBLIC_SLUG_LENGTH = 12;

/**
 * Alfabeto del slug público (§43).
 *
 * Sin vocales ni caracteres que se confundan al leerlos en voz alta o al
 * teclearlos desde un papel: nada de `0`, `O`, `1`, `l`, `I`. Sin vocales
 * tampoco sale por azar ninguna palabra que a nadie le apetezca llevar como
 * identificador.
 */
export const PUBLIC_SLUG_ALPHABET = '23456789bcdfghjkmnpqrstvwxyz';


/**
 * Canales de contacto externos (V2 §59). Afinia no tiene chat (§57): enlaza al
 * canal que el estudiante decidió compartir.
 */
export enum ContactChannelType {
  TEAMS = 'teams',
  WHATSAPP = 'whatsapp',
  LINKEDIN = 'linkedin',
  EMAIL = 'email',
  LINK = 'link',
}

export const CONTACT_CHANNEL_LABEL: Record<ContactChannelType, string> = {
  [ContactChannelType.TEAMS]: 'Microsoft Teams',
  [ContactChannelType.WHATSAPP]: 'WhatsApp',
  [ContactChannelType.LINKEDIN]: 'LinkedIn',
  [ContactChannelType.EMAIL]: 'Correo de contacto',
  [ContactChannelType.LINK]: 'Otro enlace',
};

/** Límites de la nota personal sobre un contacto (V2 §56). */
export const CONTACT_ALIAS_MAX = 60;
export const CONTACT_CONTEXT_MAX = 300;
