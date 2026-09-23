export enum RolNombre {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  CAREER_DIRECTOR = 'CAREER_DIRECTOR',
  SCIENTIFIC_SOCIETY = 'SCIENTIFIC_SOCIETY',
  ADMIN = 'ADMIN',
}

/**
 * Roles institucionales, los que no son estudiante.
 * Se conserva porque al editar un usuario la interfaz distingue ambos grupos.
 */
export const INSTITUTIONAL_ROLES = [
  RolNombre.TEACHER,
  RolNombre.CAREER_DIRECTOR,
  RolNombre.SCIENTIFIC_SOCIETY,
];

/**
 * Roles que el administrador puede provisionar (§9.2).
 *
 * Incluye estudiante: desde que no hay registro público, también esas cuentas
 * nacen aquí o por importación de padrón. La de administrador sigue creándose
 * por seed, no desde esta pantalla.
 */
export const PROVISIONABLE_ROLES = [
  RolNombre.STUDENT,
  RolNombre.TEACHER,
  RolNombre.CAREER_DIRECTOR,
  RolNombre.SCIENTIFIC_SOCIETY,
];

/** Semestres de la carrera. */
export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export const GAMIFICATION_TRIGGERS = [
  { value: 'participacion_confirmada', label: 'Participación confirmada' },
  { value: 'proyecto_registrado', label: 'Proyecto registrado' },
  { value: 'evidencia_adjunta', label: 'Evidencia adjunta' },
  { value: 'certificado_externo', label: 'Certificado externo' },
  { value: 'constancia_interna', label: 'Constancia interna' },
  { value: 'perfil_completo', label: 'Perfil completo' },
];

export const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'Estudiante',
  TEACHER: 'Docente',
  CAREER_DIRECTOR: 'Director de carrera',
  SCIENTIFIC_SOCIETY: 'Sociedad científica',
  ADMIN: 'Administrador',
};

/*
 * Aquí vivían ACTIVITY_TYPES y ACTIVITY_CATEGORIES, copias en duro de lo que
 * las pantallas ya piden al catálogo real. No las leía nadie.
 */

export const ACTIVITY_MODALITIES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hibrida', label: 'Híbrida' },
];

export const ACTIVITY_STATUSES = ['draft', 'published', 'open', 'closed', 'finished', 'cancelled'];
export const PROJECT_STATUSES = ['draft', 'active', 'archived'];

export const AFFINITY_BADGE: Record<string, string> = {
  low: 'badge-gray',
  medium: 'badge-amber',
  high: 'badge-green',
};

export const REGISTRATION_BADGE: Record<string, string> = {
  interested: 'badge-gray',
  registered: 'badge-amber',
  confirmed: 'badge-green',
  absent: 'badge-red',
  cancelled: 'badge-gray',
};

// Etiquetas en español para valores internos
export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  academica: 'Académica',
  extracurricular: 'Extracurricular',
};
export const ACTIVITY_STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  open: 'Abierta',
  closed: 'Cerrada',
  finished: 'Finalizada',
  cancelled: 'Cancelada',
};
/*
 * Las etiquetas salen del enum `RegistrationStatus` (§23), no del gusto de
 * cada pantalla. Decían otra cosa: «absent» aparecía como «Rechazado», que le
 * dice al estudiante que le negaron la inscripción cuando lo que ocurrió es
 * que se inscribió y no asistió. Y «cancelled» no estaba, así que una baja se
 * mostraba con el valor interno en crudo.
 */
export const REGISTRATION_STATUS_LABEL: Record<string, string> = {
  interested: 'Interesado',
  registered: 'Inscrito',
  confirmed: 'Participación confirmada',
  absent: 'Ausente',
  cancelled: 'Baja',
};
export const AFFINITY_LEVEL_LABEL: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};
export const PROJECT_STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  archived: 'Archivado',
};
export const PROFILE_STATUS_LABEL: Record<string, string> = {
  incomplete: 'Incompleto',
  active: 'Activo',
  updated: 'Actualizado',
};
export const lbl = (map: Record<string, string>, v: string) => map[v] ?? v;
