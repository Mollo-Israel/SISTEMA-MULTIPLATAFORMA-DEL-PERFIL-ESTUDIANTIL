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
        { to: '/student/profile', label: 'Perfil dinámico' },
        { to: '/student/onboarding', label: 'Orientación académica' },
        { to: '/student/interests', label: 'Intereses y habilidades' },
        { to: '/student/projects', label: 'Proyectos' },
        { to: '/student/evidences', label: 'Evidencias y certificados' },
        { to: '/student/affinity', label: 'Áreas de afinidad' },
        { to: '/student/recommendations', label: 'Recomendaciones' },
        { to: '/student/collaboration', label: 'Colaboración' },
        { to: '/student/progress', label: 'Mi progreso' },
        { to: '/student/privacy', label: 'Privacidad' },
      ],
    },
    {
      section: 'Comunidad',
      items: [{ to: '/student/activities', label: 'Actividades' }],
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
        { to: '/teacher/reports', label: 'Reportes del curso' },
      ],
    },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    {
      section: 'Dirección',
      items: [
        { to: '/director', label: 'Panel general' },
        { to: '/director/activities', label: 'Actividades académicas' },
        { to: '/director/constancies', label: 'Constancias internas' },
        { to: '/director/affinity', label: 'Mapa de afinidad' },
        { to: '/director/trends', label: 'Tendencias' },
        { to: '/director/resources', label: 'Catálogo de recursos' },
      ],
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
  ],
  [RolNombre.ADMIN]: [
    {
      section: 'Administración',
      items: [
        { to: '/admin', label: 'Usuarios' },
        { to: '/admin/imports', label: 'Importar padrón' },
        { to: '/admin/roles', label: 'Roles' },
        { to: '/admin/areas', label: 'Áreas académicas' },
        { to: '/admin/skills', label: 'Catálogo de habilidades' },
        { to: '/admin/activity-categories', label: 'Categorías de actividad' },
        { to: '/admin/gamification', label: 'Criterios de gamificación' },
      ],
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
