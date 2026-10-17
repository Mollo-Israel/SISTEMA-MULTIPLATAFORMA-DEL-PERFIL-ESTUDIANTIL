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

/**
 * V3.2 §60: el diagnóstico del correo es configuración de despliegue, no parte
 * del producto ordinario. Solo aparece en desarrollo o con el modo técnico
 * explícito (`VITE_TECHNICAL_MODE=true`); la API aplica la misma regla.
 */
export const MODO_TECNICO = import.meta.env.DEV || import.meta.env.VITE_TECHNICAL_MODE === 'true';

export const NAV: Record<string, NavGroup[]> = {
  [RolNombre.STUDENT]: [
    {
      section: 'Mi espacio',
      items: [
        { to: '/student', label: 'Inicio' },
        { to: '/student/profile', label: 'Mi perfil' },
        { to: '/student/projects', label: 'Proyectos' },
        { to: '/student/evidences', label: 'Credenciales y constancias' },
        { to: '/student/affinity', label: 'Áreas de afinidad' },
      ],
    },
    {
      section: 'Comunidad',
      items: [
        { to: '/student/activities', label: 'Actividades' },
        { to: '/student/library', label: 'Biblioteca' },
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
        // V3 §51: un solo panel con pestañas. V3.2 §56: cada función tiene su
        // entrada en el menú (apunta a su pestaña; no hay un segundo panel).
        { to: '/teacher', label: 'Inicio / Panel académico' },
        { to: '/teacher?tab=actividades', label: 'Actividades de la carrera' },
        { to: '/teacher/my-activities', label: 'Mis actividades' },
        { to: '/teacher?tab=estudiantes', label: 'Estudiantes' },
        { to: '/teacher?tab=proyectos', label: 'Proyectos de estudiantes' },
        { to: '/teacher?tab=equipos', label: 'Necesidades de equipo' },
        { to: '/teacher?tab=semestre', label: 'Reporte por semestre' },
        { to: '/teacher/resources', label: 'Proponer recursos' },
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

if (MODO_TECNICO) {
  NAV[RolNombre.ADMIN][0].items.push({ to: '/admin/mail', label: 'Correo (configuración técnica)' });
}
