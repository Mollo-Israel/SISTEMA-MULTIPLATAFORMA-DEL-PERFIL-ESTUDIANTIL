import { RolNombre } from './constants';

export interface NavItem {
  to: string;
  label: string;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

/*
 * Había aquí una sección «Próximamente» con Chat, Contactos QR y Equipos.
 * Las tres funciones existen desde BATCH 8 y viven en «Colaboración»; la
 * sección seguía anunciando como futuro algo que ya se entrega, y además se
 * mostraba a docentes, dirección y administración, a quienes nunca les tocó.
 */

export const NAV: Record<string, NavGroup[]> = {
  [RolNombre.STUDENT]: [
    {
      section: 'Mi espacio',
      items: [
        { to: '/student', label: 'Inicio' },
        { to: '/student/profile', label: 'Mi perfil' },
        { to: '/student/projects', label: 'Proyectos' },
        { to: '/student/evidences', label: 'Evidencias y certificados' },
        { to: '/student/affinity', label: 'Áreas de afinidad' },
      ],
    },
    {
      section: 'Comunidad',
      items: [
        { to: '/student/activities', label: 'Actividades' },
        { to: '/student/collaboration', label: 'Colaboración' },
        { to: '/student/collaboration?tab=equipos', label: 'Equipos' },
      ],
    },
    {
      section: 'Mi trayectoria',
      items: [
        { to: '/student/progress', label: 'Mi progreso' },
        { to: '/student/progress?tab=resumen', label: 'CV / Exportar' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda' }],
    },
  ],
  [RolNombre.TEACHER]: [
    {
      section: 'Docente',
      items: [
        // V3 §51: un solo panel con pestañas (Resumen, Por semestre,
        // Estudiantes, Proyectos visibles, Actividades, Necesidades/equipos).
        { to: '/teacher', label: 'Inicio / Panel académico' },
        { to: '/teacher/my-activities', label: 'Mis actividades' },
        { to: '/teacher/recognitions', label: 'Retos y recompensas' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda' }],
    },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    {
      section: 'Dirección',
      items: [
        // V3 §52: Inicio, Aprobaciones, Actividades, Constancias, Recursos y
        // Analítica (Panel, Mapa y Tendencias ya no se repiten).
        { to: '/director', label: 'Inicio' },
        { to: '/director/approvals', label: 'Aprobaciones' },
        { to: '/director/activities', label: 'Actividades' },
        { to: '/director/constancies', label: 'Constancias' },
        { to: '/director/credential-reviews', label: 'Revisión de credenciales' },
        { to: '/director/resources', label: 'Recursos' },
        { to: '/director/analytics', label: 'Analítica' },
        { to: '/director/recognitions', label: 'Retos y recompensas' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda' }],
    },
  ],
  [RolNombre.SCIENTIFIC_SOCIETY]: [
    {
      section: 'Sociedad científica',
      items: [
        // V3 §53.
        { to: '/society', label: 'Inicio' },
        { to: '/society/activities', label: 'Mis actividades' },
        { to: '/society/activities?nuevo=1', label: 'Crear actividad' },
        { to: '/society/participants', label: 'Participantes' },
        { to: '/society/metrics', label: 'Métricas' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda' }],
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
        { to: '/admin/activity-categories', label: 'Categorías' },
        { to: '/admin/activities', label: 'Actividades / oportunidades' },
        { to: '/admin/resources', label: 'Recursos' },
        { to: '/admin/gamification', label: 'Gamificación' },
        { to: '/admin/recognitions', label: 'Retos y recompensas' },
        { to: '/admin/audit', label: 'Auditoría' },
        { to: '/admin/mail', label: 'Correo (configuración técnica)' },
      ],
    },
    {
      section: 'Ayuda',
      items: [{ to: '/ayuda', label: 'Ayuda' }],
    },
  ],
};

export const HOME_BY_ROLE: Record<string, string> = {
  [RolNombre.STUDENT]: '/student',
  [RolNombre.TEACHER]: '/teacher',
  [RolNombre.CAREER_DIRECTOR]: '/director',
  [RolNombre.SCIENTIFIC_SOCIETY]: '/society',
  [RolNombre.ADMIN]: '/admin',
};
