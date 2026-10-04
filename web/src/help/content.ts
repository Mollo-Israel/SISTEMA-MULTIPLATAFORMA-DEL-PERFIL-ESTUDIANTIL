import { RolNombre } from '../constants';

/**
 * Contenido del tutorial de primer uso y del centro de ayuda (V2 §65).
 *
 * Texto corto y por actor: cada uno ve lo que puede hacer, con un enlace a la
 * pantalla donde se hace. Vive aparte de los componentes para que corregir
 * una frase no obligue a tocar lógica.
 */

export interface TutorialStep {
  title: string;
  text: string;
  /** Pantalla a la que lleva el paso, si la hay. */
  to?: string;
  icon: 'home' | 'user' | 'calendar' | 'folder' | 'target' | 'users' | 'award' | 'shield' | 'check' | 'chart' | 'upload' | 'settings';
}

export interface HelpTopic {
  question: string;
  answer: string;
  to?: string;
}

export const TUTORIAL: Record<string, TutorialStep[]> = {
  [RolNombre.STUDENT]: [
    { icon: 'home', title: 'Tu inicio', text: 'Aquí ves en qué vas: tu perfil, tus actividades y lo que te recomendamos según tus intereses.', to: '/student' },
    { icon: 'calendar', title: 'Actividades', text: 'Inscríbete en talleres y actividades. Solo la participación confirmada por quien la organiza cuenta como experiencia.', to: '/student/activities' },
    { icon: 'folder', title: 'Proyectos y evidencias', text: 'Registra tus proyectos, confirma las tecnologías que usaste y sube evidencias. Eso es lo que respalda tu afinidad.', to: '/student/projects' },
    { icon: 'target', title: 'Afinidad', text: 'Tu afinidad por área sale de lo que hiciste y está respaldado, no de lo que declaras. Siempre puedes ver de dónde sale cada punto.', to: '/student/affinity' },
    { icon: 'users', title: 'Colaboración', text: 'Comparte tu perfil con un QR, acepta contactos y forma equipos con quien complemente lo que te falta.', to: '/student/collaboration' },
    { icon: 'award', title: 'Mi progreso y CV', text: 'Mira tus insignias y descarga tu CV en PDF con la plantilla que prefieras.', to: '/student/progress' },
  ],
  [RolNombre.TEACHER]: [
    { icon: 'home', title: 'Tu panel', text: 'Ves solo a los estudiantes de los semestres que la administración te habilitó.', to: '/teacher' },
    { icon: 'calendar', title: 'Tus actividades', text: 'Crea talleres en borrador y envíalos a Dirección. Cuando los aprueba, puedes publicarlos y confirmar la participación.', to: '/teacher/my-activities' },
    { icon: 'folder', title: 'Proyectos estudiantiles', text: 'Consulta los proyectos que los estudiantes abrieron a docentes y deja retroalimentación.', to: '/teacher/projects' },
    { icon: 'chart', title: 'Panel académico', text: 'Un resumen por semestre: participación, proyectos y necesidades de equipo. No es el registro de una asignatura.', to: '/teacher/reports' },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    { icon: 'check', title: 'Aprobaciones', text: 'Las actividades de docentes y sociedad llegan aquí. Apruébalas, obsérvalas con un comentario o recházalas.', to: '/director/approvals' },
    { icon: 'calendar', title: 'Actividades académicas', text: 'Las que creas tú se publican directamente.', to: '/director/activities' },
    { icon: 'award', title: 'Constancias internas', text: 'Se emiten solo sobre participación confirmada en actividades que las tienen habilitadas.', to: '/director/constancies' },
    { icon: 'chart', title: 'Mapa y tendencias', text: 'Analítica descriptiva de la carrera. Los grupos muy pequeños no se desglosan para proteger a las personas.', to: '/director/trends' },
  ],
  [RolNombre.SCIENTIFIC_SOCIETY]: [
    { icon: 'calendar', title: 'Tus actividades', text: 'Crea actividades extracurriculares y envíalas a Dirección. Aprobadas, las publicas y confirmas a quienes participaron.', to: '/society/activities' },
    { icon: 'chart', title: 'Métricas', text: 'Inscritos, confirmados, ausencias y quiénes vuelven, solo de tus actividades.', to: '/society/metrics' },
  ],
  [RolNombre.ADMIN]: [
    { icon: 'users', title: 'Usuarios', text: 'Da de alta cuentas con su rol. Cada persona activa la suya desde el correo; nunca recibes su contraseña ni su código.', to: '/admin' },
    { icon: 'upload', title: 'Importar padrón', text: 'Carga estudiantes en lote desde una planilla, con validación fila por fila.', to: '/admin/imports' },
    { icon: 'settings', title: 'Catálogos', text: 'Áreas, habilidades con sus alias y categorías de actividad. Las tecnologías conocidas no se pueden guardar en un área equivocada.', to: '/admin/areas' },
    { icon: 'shield', title: 'Auditoría', text: 'Qué pasó, quién lo hizo y cuándo, sin datos sensibles.', to: '/admin/audit' },
  ],
};

export const HELP: Record<string, HelpTopic[]> = {
  [RolNombre.STUDENT]: [
    { question: '¿Por qué mi afinidad no sube si marqué que me interesa un área?', answer: 'Los intereses orientan tus recomendaciones, pero la afinidad solo cuenta lo que hiciste y está respaldado: actividades confirmadas, proyectos con evidencia y certificados.', to: '/student/affinity' },
    { question: '¿Qué significa «con respaldo»?', answer: 'Que hay algo que lo sostiene además de tu palabra: una evidencia, una confirmación del organizador o la revisión de un docente. «No se pudo comprobar» quiere decir que la verificación automática no encontró el recurso; no es una sanción.' },
    { question: '¿Quién puede ver mi perfil?', answer: 'Nadie fuera del sistema, salvo que actives tu perfil compartible. Tú eliges qué se muestra; tu correo institucional y tu código no aparecen nunca por omisión.', to: '/student/privacy' },
    { question: '¿Cómo me contactan si no hay chat?', answer: 'Configura tus canales (Teams, WhatsApp, LinkedIn, correo o un enlace) en Colaboración. Tus contactos aceptados los ven; en tu perfil público, solo los que marques.', to: '/student/collaboration' },
    { question: '¿El CV es un documento oficial?', answer: 'No. Resume lo registrado en Afinia y lo dice en el propio PDF. Si usas la ayuda de redacción, nada entra al CV hasta que eliges la propuesta.', to: '/student/progress' },
  ],
  [RolNombre.TEACHER]: [
    { question: '¿Por qué no veo a un estudiante?', answer: 'Solo ves a quienes cursan los semestres que tienes habilitados. Si falta un semestre, pídelo a la administración.' },
    { question: '¿Por qué no puedo publicar mi actividad?', answer: 'Las actividades de docentes pasan por Dirección. Envíala a revisión; si te la observan, corrige y reenvíala.', to: '/teacher/my-activities' },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    { question: '¿Por qué una fila dice «sin desglose»?', answer: 'Porque el grupo es tan pequeño que el detalle identificaría a las personas. Se muestra el tamaño del grupo y no sus datos.' },
    { question: '¿Qué apruebo junto con una actividad?', answer: 'Su contenido, si emite constancia interna y cuántos puntos da por participar.', to: '/director/approvals' },
  ],
  [RolNombre.SCIENTIFIC_SOCIETY]: [
    { question: '¿Por qué mi actividad sigue en borrador?', answer: 'Hasta que Dirección la aprueba no se puede publicar. Revisa su estado en la columna «Revisión».', to: '/society/activities' },
  ],
  [RolNombre.ADMIN]: [
    { question: 'Un estudiante no recibió el correo de activación', answer: 'Revisa el estado del envío en Usuarios y reenvía la invitación. La configuración del correo está en «Correo».', to: '/admin/mail' },
    { question: '¿Puedo ver la contraseña o el código de alguien?', answer: 'No. Ni la contraseña ni el código de activación se muestran a nadie; solo llegan al correo del titular.' },
  ],
};
