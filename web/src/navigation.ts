import { RolNombre } from './constants';

export interface NavItem {
  to: string;
  label: string;
  /** V7: qué se hace ahí, en palabras simples (tooltip y accesos del inicio). */
  hint?: string;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

/** V7: accesos de la barra inferior en el teléfono (máximo cuatro + «Más»). */
export interface TabItem {
  to: string;
  label: string;
}

/*
 * Había aquí una sección «Próximamente» con Chat, Contactos QR y Equipos.
 * Las tres funciones existen desde BATCH 8 y viven en «Colaboración»; la
 * sección seguía anunciando como futuro algo que ya se entrega, y además se
 * mostraba a docentes, dirección y administración, a quienes nunca les tocó.
 */

/**
 * V3.2 §60: el diagnóstico del correo es configuración de despliegue, no parte
 * del producto ordinario. Solo aparece en desarrollo o con el modo técnico
 * explícito (`VITE_TECHNICAL_MODE=true`); la API aplica la misma regla.
 */
export const MODO_TECNICO = import.meta.env.DEV || import.meta.env.VITE_TECHNICAL_MODE === 'true';

/*
 * V7: los nombres de cada opción son los del contrato (las pruebas los
 * verifican); lo que cambia es cómo se agrupan para Estudiante, Docente,
 * Dirección y Sociedad —por lo que la persona quiere hacer, no por módulo— y
 * una pista corta de qué hay en cada una. Administración conserva su menú.
 */
export const NAV: Record<string, NavGroup[]> = {
  [RolNombre.STUDENT]: [
    {
      section: 'Mi espacio',
      items: [
        { to: '/student', label: 'Inicio', hint: 'Cómo vas y qué puedes hacer ahora' },
        { to: '/student/profile', label: 'Mi perfil', hint: 'Tus datos, intereses y tecnologías' },
        { to: '/student/projects', label: 'Proyectos', hint: 'Lo que construiste y tu aporte' },
        { to: '/student/evidences', label: 'Evidencias y credenciales', hint: 'Certificados y constancias que te respaldan' },
        { to: '/student/affinity', label: 'Áreas de afinidad', hint: 'Las áreas en las que destacas' },
      ],
    },
    {
      section: 'Descubrir',
      items: [
        { to: '/student/activities', label: 'Actividades', hint: 'Talleres y eventos para inscribirte' },
        { to: '/student/library', label: 'Biblioteca', hint: 'Recursos para aprender' },
        { to: '/proyectos', label: 'Proyectos de la carrera', hint: 'Lo que hacen tus compañeros' },
      ],
    },
    {
      // V4.1 A41-026 (§16): Contactos y Equipos agrupados en Colaboración; el
      // enlace y el QR se administran en Mi perfil → Visibilidad.
      section: 'Con otros',
      items: [
        { to: '/student/collaboration?tab=contactos', label: 'Contactos', hint: 'Compañeros que guardaste' },
        { to: '/student/collaboration?tab=equipos', label: 'Equipos', hint: 'Equipos que buscan gente' },
      ],
    },
    {
      section: 'Mi camino',
      items: [
        { to: '/student/progress', label: 'Mi progreso', hint: 'Puntos, insignias y recompensas' },
        { to: '/student/progress?tab=resumen', label: 'Resumen de trayectoria', hint: 'Tu historia lista para compartir' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda', hint: 'Preguntas frecuentes y tutorial' }],
    },
  ],
  [RolNombre.TEACHER]: [
    {
      section: 'Mi día a día',
      items: [
        // V3 §51: un solo panel con pestañas. V3.2 §56: cada función tiene su
        // entrada en el menú (apunta a su pestaña; no hay un segundo panel).
        { to: '/teacher', label: 'Inicio / Panel académico', hint: 'Un vistazo a tus estudiantes' },
        { to: '/teacher/my-activities', label: 'Mis actividades', hint: 'Las actividades que organizas' },
        { to: '/teacher?tab=actividades', label: 'Actividades de la carrera', hint: 'Todo lo que se ofrece en la carrera' },
      ],
    },
    {
      section: 'Mis estudiantes',
      items: [
        { to: '/teacher?tab=estudiantes', label: 'Estudiantes', hint: 'Quiénes son y qué están haciendo' },
        { to: '/teacher?tab=proyectos', label: 'Proyectos de estudiantes', hint: 'Revisa sus proyectos y respaldos' },
        { to: '/teacher?tab=equipos', label: 'Necesidades de equipo', hint: 'Equipos que buscan integrantes' },
        { to: '/teacher?tab=semestre', label: 'Reporte por semestre', hint: 'Cómo va cada semestre' },
        { to: '/teacher/points', label: 'Puntos de estudiantes', hint: 'Reconoce su participación' },
      ],
    },
    {
      section: 'Compartir',
      items: [
        { to: '/teacher/resources', label: 'Proponer recursos', hint: 'Sugiere material para aprender' },
        { to: '/proyectos', label: 'Proyectos de la carrera', hint: 'La galería pública de la carrera' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda', hint: 'Preguntas frecuentes y tutorial' }],
    },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    {
      section: 'Para decidir',
      items: [
        // V3 §52: Inicio, Aprobaciones, Actividades, Constancias, Recursos y
        // Analítica (Panel, Mapa y Tendencias ya no se repiten).
        { to: '/director', label: 'Inicio', hint: 'Lo que espera tu decisión' },
        { to: '/director/approvals', label: 'Aprobaciones', hint: 'Actividades propuestas por revisar' },
        { to: '/director/credential-reviews', label: 'Revisión de credenciales', hint: 'Casos especiales que piden tu mirada' },
        // V5 §9.2: excepciones de revisión por docente y módulo.
        { to: '/director/autonomy', label: 'Autonomía docente', hint: 'Qué puede aprobar cada docente' },
      ],
    },
    {
      section: 'La carrera',
      items: [
        { to: '/director/activities', label: 'Actividades', hint: 'Todas las actividades de la carrera' },
        { to: '/director/constancies', label: 'Participaciones', hint: 'Quién participó y en qué' },
        { to: '/director/resources', label: 'Recursos', hint: 'Material de aprendizaje publicado' },
        { to: '/proyectos', label: 'Proyectos de la carrera', hint: 'La galería pública de la carrera' },
      ],
    },
    {
      section: 'Seguimiento',
      items: [
        { to: '/director/analytics', label: 'Analítica', hint: 'Participación, afinidad y tendencias' },
        { to: '/director/points', label: 'Puntos de estudiantes', hint: 'Reconocimientos otorgados' },
        { to: '/director/gamification', label: 'Criterios de puntos', hint: 'Cómo se ganan los puntos' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda', hint: 'Preguntas frecuentes y tutorial' }],
    },
  ],
  [RolNombre.SCIENTIFIC_SOCIETY]: [
    {
      section: 'Mi sociedad',
      items: [
        // V3 §53.
        { to: '/society', label: 'Inicio', hint: 'Tus actividades de un vistazo' },
        { to: '/society/activities', label: 'Mis actividades', hint: 'Crea y organiza tus actividades' },
        { to: '/society/participants', label: 'Participantes', hint: 'Inscritos y asistencia' },
        { to: '/society/metrics', label: 'Métricas', hint: 'El alcance de lo que organizas' },
      ],
    },
    {
      section: 'Comunidad',
      items: [{ to: '/proyectos', label: 'Proyectos de la carrera', hint: 'La galería pública de la carrera' }],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda', hint: 'Preguntas frecuentes y tutorial' }],
    },
  ],
  [RolNombre.ADMIN]: [
    {
      section: 'Administración',
      items: [
        // V3 §54. Los semestres del docente se gestionan dentro de Usuarios.
        { to: '/admin', label: 'Inicio' },
        { to: '/admin/users', label: 'Usuarios' },
        { to: '/admin/imports', label: 'Importar padrón' },
        { to: '/admin/areas', label: 'Áreas y habilidades' },
        { to: '/admin/skill-requests', label: 'Pedidos de tecnologías' },
        { to: '/admin/activity-categories', label: 'Categorías' },
        { to: '/admin/activities', label: 'Actividades / oportunidades' },
        { to: '/admin/resources', label: 'Recursos' },
        { to: '/admin/gamification', label: 'Gamificación' },
        { to: '/admin/points', label: 'Puntos de estudiantes' },
        { to: '/admin/credential-reviews', label: 'Revisión de credenciales' },
        { to: '/admin/audit', label: 'Auditoría' },
        { to: '/proyectos', label: 'Proyectos de la carrera' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda' }],
    },
  ],
};

/**
 * V7: la barra inferior del teléfono para los cuatro roles de uso diario,
 * como una app. «Más» abre el menú completo. Administración no la tiene: su
 * trabajo es de escritorio.
 */
export const TABBAR: Record<string, TabItem[]> = {
  [RolNombre.STUDENT]: [
    { to: '/student', label: 'Inicio' },
    { to: '/student/activities', label: 'Actividades' },
    { to: '/student/projects', label: 'Proyectos' },
    { to: '/student/profile', label: 'Perfil' },
  ],
  [RolNombre.TEACHER]: [
    { to: '/teacher', label: 'Inicio' },
    { to: '/teacher?tab=estudiantes', label: 'Estudiantes' },
    { to: '/teacher/my-activities', label: 'Actividades' },
    { to: '/teacher?tab=proyectos', label: 'Proyectos' },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    { to: '/director', label: 'Inicio' },
    { to: '/director/approvals', label: 'Aprobar' },
    { to: '/director/activities', label: 'Actividades' },
    { to: '/director/analytics', label: 'Analítica' },
  ],
  [RolNombre.SCIENTIFIC_SOCIETY]: [
    { to: '/society', label: 'Inicio' },
    { to: '/society/activities', label: 'Actividades' },
    { to: '/society/participants', label: 'Inscritos' },
    { to: '/society/metrics', label: 'Métricas' },
  ],
};

export const HOME_BY_ROLE: Record<string, string> = {
  [RolNombre.STUDENT]: '/student',
  [RolNombre.TEACHER]: '/teacher',
  [RolNombre.CAREER_DIRECTOR]: '/director',
  [RolNombre.SCIENTIFIC_SOCIETY]: '/society',
  [RolNombre.ADMIN]: '/admin',
};

// V6 §12.1: «Correo (configuración técnica)» ya no está en el menú, en ningún
// modo. La pantalla sigue en /admin/mail, solo para Administración (RoleGate en
// la web y @Roles(ADMIN) en la API); ocultar el enlace no es el control de acceso.
