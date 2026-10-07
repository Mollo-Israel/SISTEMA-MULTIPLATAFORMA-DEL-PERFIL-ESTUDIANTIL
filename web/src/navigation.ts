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
        { to: '/student/recommendations', label: 'Recomendaciones' },
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
        { to: '/teacher', label: 'Panel' },
        { to: '/teacher/my-activities', label: 'Mis actividades' },
        { to: '/teacher/activities', label: 'Actividades del programa' },
        { to: '/teacher/students', label: 'Perfil de estudiante' },
        { to: '/teacher/projects', label: 'Proyectos estudiantiles' },
        { to: '/teacher/reports', label: 'Panel académico' },
        { to: '/teacher/team-needs', label: 'Necesidades de equipo' },
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
        { to: '/director', label: 'Panel general' },
        { to: '/director/approvals', label: 'Aprobaciones' },
        { to: '/director/activities', label: 'Actividades académicas' },
        { to: '/director/constancies', label: 'Constancias internas' },
        { to: '/director/affinity', label: 'Mapa de afinidad' },
        { to: '/director/trends', label: 'Tendencias' },
        { to: '/director/resources', label: 'Catálogo de recursos' },
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
        { to: '/society', label: 'Panel' },
        { to: '/society/activities', label: 'Actividades extracurriculares' },
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
        { to: '/admin', label: 'Usuarios' },
        { to: '/admin/imports', label: 'Importar padrón' },
        { to: '/admin/areas', label: 'Áreas y habilidades' },
        { to: '/admin/activity-categories', label: 'Categorías de actividad' },
        { to: '/admin/resources', label: 'Recursos' },
        { to: '/admin/gamification', label: 'Puntos por logros' },
        { to: '/admin/recognitions', label: 'Retos y recompensas' },
        { to: '/admin/audit', label: 'Auditoría' },
        { to: '/admin/mail', label: 'Correo' },
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
