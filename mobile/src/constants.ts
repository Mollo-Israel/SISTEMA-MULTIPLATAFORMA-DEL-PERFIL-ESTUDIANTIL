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
