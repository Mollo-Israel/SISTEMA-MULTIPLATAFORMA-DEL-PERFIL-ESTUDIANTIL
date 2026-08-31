export const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'Estudiante',
  TEACHER: 'Docente',
  CAREER_DIRECTOR: 'Director de carrera',
  SCIENTIFIC_SOCIETY: 'Sociedad científica',
  ADMIN: 'Administrador',
};

export const ACTIVITY_CATEGORIES = [
  { value: 'taller_academico', label: 'Taller académico' },
  { value: 'clase_espejo', label: 'Clase espejo' },
  { value: 'seminario', label: 'Seminario' },
  { value: 'charla', label: 'Charla' },
  { value: 'curso_externo_recomendado', label: 'Curso externo recomendado' },
  { value: 'reto', label: 'Reto' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'convocatoria', label: 'Convocatoria' },
  { value: 'actividad_sociedad_cientifica', label: 'Actividad sociedad científica' },
  { value: 'club_estudio', label: 'Club de estudio' },
  { value: 'tutoria', label: 'Tutoría' },
  { value: 'investigacion', label: 'Investigación' },
  { value: 'responsabilidad_social', label: 'Responsabilidad social' },
  { value: 'integracion', label: 'Integración' },
];

export const categoryLabel = (v: string) =>
  ACTIVITY_CATEGORIES.find((c) => c.value === v)?.label ?? v;

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
  registered: 'Inscrito',
  confirmed: 'Participación confirmada',
  absent: 'Ausente',
};

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  academica: 'Académica',
  extracurricular: 'Extracurricular',
};

export const ACTIVITY_STATUSES = ['draft', 'published', 'open', 'closed', 'finished', 'cancelled'];

/** Categorías propias de cada tipo, según el documento del proyecto. */
export const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  academica: ['taller_academico', 'clase_espejo', 'seminario', 'charla', 'curso_externo_recomendado', 'tutoria', 'investigacion'],
  extracurricular: ['hackathon', 'reto', 'convocatoria', 'actividad_sociedad_cientifica', 'club_estudio', 'responsabilidad_social', 'integracion'],
};

export const lbl = (map: Record<string, string>, v: string) => map[v] ?? v;
