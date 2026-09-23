export const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'Estudiante',
  TEACHER: 'Docente',
  CAREER_DIRECTOR: 'Director de carrera',
  SCIENTIFIC_SOCIETY: 'Sociedad científica',
  ADMIN: 'Administrador',
};

/*
 * Aquí vivían las categorías de actividad escritas a mano y el `categoryLabel`
 * que las leía. Las administra el administrador (§21), así que una categoría
 * nueva salía con su valor interno en crudo mientras la web mostraba su
 * nombre. Ahora las pantallas usan `useCategoryLabel`, que lee el catálogo.
 */

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
  cancelled: 'Baja',
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
