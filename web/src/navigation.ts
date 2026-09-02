import { RolNombre } from './constants';

export interface NavItem {
  to: string;
  label: string;
  soon?: boolean;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

const comingSoon: NavItem[] = [
  { to: '#', label: 'Chat', soon: true },
  { to: '#', label: 'Contactos QR', soon: true },
  { to: '#', label: 'Equipos', soon: true },
];

export const NAV: Record<string, NavGroup[]> = {
  [RolNombre.STUDENT]: [
    {
      section: 'Mi espacio',
      items: [
        { to: '/student', label: 'Inicio' },
        { to: '/student/profile', label: 'Perfil dinámico' },
        { to: '/student/interests', label: 'Intereses y habilidades' },
        { to: '/student/projects', label: 'Proyectos' },
        { to: '/student/evidences', label: 'Evidencias y certificados' },
        { to: '/student/affinity', label: 'Áreas de afinidad' },
      ],
    },
    {
      section: 'Comunidad',
      items: [{ to: '/student/activities', label: 'Actividades' }],
    },
    { section: 'Próximamente', items: comingSoon },
  ],
  [RolNombre.TEACHER]: [
    {
      section: 'Docente',
      items: [
        { to: '/teacher', label: 'Panel' },
        { to: '/teacher/activities', label: 'Actividades del programa' },
        { to: '/teacher/students', label: 'Perfil de estudiante' },
        { to: '/teacher/projects', label: 'Proyectos estudiantiles' },
        { to: '/teacher/reports', label: 'Reportes del curso' },
      ],
    },
    { section: 'Próximamente', items: comingSoon },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    {
      section: 'Dirección',
      items: [
        { to: '/director', label: 'Panel general' },
        { to: '/director/activities', label: 'Actividades académicas' },
        { to: '/director/constancies', label: 'Constancias internas' },
        { to: '/director/affinity', label: 'Mapa de afinidad' },
      ],
    },
    { section: 'Próximamente', items: comingSoon },
  ],
  [RolNombre.SCIENTIFIC_SOCIETY]: [
    {
      section: 'Sociedad científica',
      items: [
        { to: '/society', label: 'Panel' },
        { to: '/society/activities', label: 'Actividades extracurriculares' },
      ],
    },
    { section: 'Próximamente', items: comingSoon },
  ],
  [RolNombre.ADMIN]: [
    {
      section: 'Administración',
      items: [
        { to: '/admin', label: 'Usuarios' },
        { to: '/admin/roles', label: 'Roles' },
        { to: '/admin/areas', label: 'Áreas académicas' },
        { to: '/admin/skills', label: 'Catálogo de habilidades' },
        { to: '/admin/activity-categories', label: 'Categorías de actividad' },
        { to: '/admin/gamification', label: 'Criterios de gamificación' },
      ],
    },
    { section: 'Próximamente', items: comingSoon },
  ],
};

export const HOME_BY_ROLE: Record<string, string> = {
  [RolNombre.STUDENT]: '/student',
  [RolNombre.TEACHER]: '/teacher',
  [RolNombre.CAREER_DIRECTOR]: '/director',
  [RolNombre.SCIENTIFIC_SOCIETY]: '/society',
  [RolNombre.ADMIN]: '/admin',
};
