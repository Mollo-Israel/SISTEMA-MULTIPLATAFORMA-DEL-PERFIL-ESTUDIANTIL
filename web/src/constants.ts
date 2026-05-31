export enum RolNombre {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  CAREER_DIRECTOR = 'CAREER_DIRECTOR',
  SCIENTIFIC_SOCIETY = 'SCIENTIFIC_SOCIETY',
  ADMIN = 'ADMIN',
}

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
