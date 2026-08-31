export enum RolNombre {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  CAREER_DIRECTOR = 'CAREER_DIRECTOR',
  SCIENTIFIC_SOCIETY = 'SCIENTIFIC_SOCIETY',
  ADMIN = 'ADMIN',
}

/** Roles que el administrador puede dar de alta (RF3). */
export const INSTITUTIONAL_ROLES = [
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

export const ACTIVITY_TYPES = [
  { value: 'academica', label: 'Académica' },
  { value: 'extracurricular', label: 'Extracurricular' },
];

export const ACTIVITY_CATEGORIES = [
  { value: 'taller_academico', label: 'Taller académico' },
  { value: 'clase_espejo', label: 'Clase espejo' },
  { value: 'seminario', label: 'Seminario' },
  { value: 'charla', label: 'Charla' },
  { value: 'curso_externo_recomendado', label: 'Curso externo recomendado' },
  { value: 'reto', label: 'Reto' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'convocatoria', label: 'Convocatoria' },
  { value: 'actividad_sociedad_cientifica', label: 'Actividad de sociedad científica' },
  { value: 'club_estudio', label: 'Club de estudio' },
  { value: 'tutoria', label: 'Tutoría' },
  { value: 'investigacion', label: 'Investigación' },
  { value: 'responsabilidad_social', label: 'Responsabilidad social' },
  { value: 'integracion', label: 'Integración' },
];

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
};

// Módulos del sistema completo que aún no entran en el 30%.
export const COMING_SOON = ['Chat', 'Contactos QR', 'Equipos avanzados'];

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
export const REGISTRATION_STATUS_LABEL: Record<string, string> = {
  interested: 'Interesado',
  registered: 'Pendiente',
  confirmed: 'Confirmado',
  absent: 'Rechazado',
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
export const CONSTANCY_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  authorized: 'Autorizada',
  rejected: 'Rechazada',
};
export const lbl = (map: Record<string, string>, v: string) => map[v] ?? v;
