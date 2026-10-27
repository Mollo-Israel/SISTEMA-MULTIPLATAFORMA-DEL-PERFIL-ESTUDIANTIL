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
  /** V3.2 §61: ilustración opcional (en `public/ayuda/`), con su texto alternativo. */
  image?: { src: string; alt: string };
}

/** V3.2 §61: temas de la ayuda, para agrupar las preguntas. */
export type HelpTema = 'cuenta' | 'perfil' | 'actividades' | 'proyectos' | 'evidencias' | 'afinidad' | 'curriculo' | 'privacidad' | 'gestion';

export const TEMA_LABEL: Record<HelpTema, string> = {
  cuenta: 'Activar la cuenta y entrar',
  perfil: 'Perfil',
  actividades: 'Actividades',
  proyectos: 'Proyectos',
  evidencias: 'Credenciales y evidencias',
  afinidad: 'Afinidad',
  curriculo: 'Currículo',
  privacidad: 'Privacidad',
  gestion: 'Gestión',
};

const IMG = {
  activacion: { src: '/ayuda/activacion.svg', alt: 'Tres pasos: alta de la cuenta, correo con código y elección de la contraseña.' },
  actividad: { src: '/ayuda/actividad-flujo.svg', alt: 'Recorrido de una actividad: borrador, en revisión, aprobada, publicada y finalizada; si la observan vuelve a borrador.' },
  afinidad: { src: '/ayuda/afinidad-fuentes.svg', alt: 'Suman a la afinidad las actividades confirmadas, los proyectos y las credenciales con respaldo; los intereses no suman.' },
  proyecto: { src: '/ayuda/proyecto-respaldo.svg', alt: 'Un proyecto gana respaldo con evidencias que lo corroboran o con la revisión de un docente.' },
};

export type HelpEntry = HelpTopic & { tema: HelpTema };

/** Preguntas comunes a todos los roles (cuenta y privacidad). */
const CUENTA: HelpEntry[] = [
  { tema: 'cuenta', question: '¿Cómo se activa una cuenta?', answer: 'La administración da de alta la cuenta; al correo de la persona llega un código de activación y con él elige su contraseña. Si el código venció, en la pantalla de activación se pide uno nuevo (hay que esperar un momento entre pedidos).', image: IMG.activacion },
  { tema: 'cuenta', question: 'Olvidé mi contraseña', answer: 'En la pantalla de ingreso usa «¿Olvidaste tu contraseña?». El código llega solo a tu correo; nadie más puede verlo ni elegir tu contraseña por ti.' },
  { tema: 'privacidad', question: '¿Alguien puede ver mi contraseña o mis códigos?', answer: 'No. Ni la administración ni el sistema los muestran: se guardan cifrados y los códigos solo llegan a tu correo. La auditoría tampoco los registra.' },
];


export const TUTORIAL: Record<string, TutorialStep[]> = {
  [RolNombre.STUDENT]: [
    { icon: 'home', title: 'Tu inicio', text: 'Aquí ves en qué vas: tu perfil, tus actividades y lo que te recomendamos según tus intereses.', to: '/student' },
    { icon: 'calendar', title: 'Actividades', text: 'Inscríbete en talleres y actividades. Solo la participación confirmada por quien la organiza cuenta como experiencia.', to: '/student/activities' },
    { icon: 'folder', title: 'Proyectos y evidencias', text: 'Registra tus proyectos, confirma las tecnologías que usaste y sube evidencias. Eso es lo que respalda tu afinidad.', to: '/student/projects' },
    { icon: 'target', title: 'Afinidad', text: 'Tu afinidad por área sale de lo que hiciste y está respaldado, no de lo que declaras. Siempre puedes ver de dónde sale cada punto.', to: '/student/affinity' },
    { icon: 'users', title: 'Colaboración', text: 'Acepta contactos y forma equipos con quien complemente lo que te falta. Tu enlace y tu QR se administran en Mi perfil → Visibilidad.', to: '/student/collaboration' },
    { icon: 'award', title: 'Mi progreso y CV', text: 'Mira tus insignias y descarga tu CV en PDF con la plantilla que prefieras.', to: '/student/progress' },
  ],
  [RolNombre.TEACHER]: [
    { icon: 'home', title: 'Tu panel', text: 'Ves solo a los estudiantes de los semestres que la administración te habilitó.', to: '/teacher' },
    { icon: 'calendar', title: 'Tus actividades', text: 'Crea talleres en borrador y envíalos a Dirección. Cuando los aprueba, puedes publicarlos y confirmar la participación.', to: '/teacher/my-activities' },
    { icon: 'calendar', title: 'Actividades de la carrera', text: 'Consulta todas las actividades publicadas de la carrera, aunque no las hayas creado tú.', to: '/teacher?tab=actividades' },
    { icon: 'folder', title: 'Proyectos estudiantiles', text: 'Consulta los proyectos que los estudiantes abrieron a docentes y deja retroalimentación.', to: '/teacher?tab=proyectos' },
    { icon: 'chart', title: 'Panel académico', text: 'Un resumen por semestre: participación, proyectos y necesidades de equipo. No es el registro de una asignatura.', to: '/teacher?tab=semestre' },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    { icon: 'check', title: 'Aprobaciones', text: 'Las actividades de docentes y sociedad llegan aquí. Apruébalas, obsérvalas con un comentario o recházalas.', to: '/director/approvals' },
    { icon: 'calendar', title: 'Actividades académicas', text: 'Las que creas tú se publican directamente.', to: '/director/activities' },
    { icon: 'award', title: 'Constancias internas', text: 'Se emiten solo sobre participación confirmada en actividades que las tienen habilitadas.', to: '/director/constancies' },
    { icon: 'chart', title: 'Mapa y tendencias', text: 'Analítica descriptiva de la carrera. Los grupos muy pequeños no se desglosan para proteger a las personas.', to: '/director/analytics' },
  ],
  [RolNombre.SCIENTIFIC_SOCIETY]: [
    { icon: 'calendar', title: 'Tus actividades', text: 'Crea actividades extracurriculares y envíalas a Dirección. Aprobadas, las publicas y confirmas a quienes participaron.', to: '/society/activities' },
    { icon: 'chart', title: 'Métricas', text: 'Inscritos, confirmados, ausencias y quiénes vuelven, solo de tus actividades.', to: '/society/metrics' },
  ],
  [RolNombre.ADMIN]: [
    { icon: 'users', title: 'Usuarios', text: 'Da de alta cuentas con su rol. Cada persona activa la suya desde el correo; nunca recibes su contraseña ni su código.', to: '/admin/users' },
    { icon: 'upload', title: 'Importar padrón', text: 'Carga estudiantes en lote desde una planilla, con validación fila por fila.', to: '/admin/imports' },
    { icon: 'settings', title: 'Catálogos', text: 'Áreas, habilidades con sus alias y categorías de actividad. Las tecnologías conocidas no se pueden guardar en un área equivocada.', to: '/admin/areas' },
    { icon: 'shield', title: 'Auditoría', text: 'Qué pasó, quién lo hizo y cuándo, sin datos sensibles.', to: '/admin/audit' },
  ],
};

export const HELP: Record<string, HelpEntry[]> = {
  [RolNombre.STUDENT]: [
    ...CUENTA,
    { tema: 'perfil', question: '¿Qué completo en mi perfil?', answer: 'Sobre ti, tus intereses y objetivos, tu disponibilidad y quién puede verlo. Los intereses orientan las recomendaciones; lo que suma a tu afinidad es lo que haces.', to: '/student/profile' },
    { tema: 'actividades', question: '¿Cómo cuenta una actividad?', answer: 'Inscríbete en Actividades. Al terminar, quien la organiza confirma tu participación: solo entonces suma a tu trayectoria y a tu afinidad, en el área de la actividad. Puedes guardar una actividad que te interese aunque ya haya pasado.', to: '/student/activities', image: IMG.actividad },
    { tema: 'proyectos', question: '¿Cómo registro un proyecto para que cuente?', answer: 'Indica sus áreas y, en cada una, las tecnologías que usaste. Agrega evidencias (repositorio, demo, capturas). El proyecto suma cuando queda con respaldo, y cada tecnología suma en el área en la que la pusiste.', to: '/student/projects', image: IMG.proyecto },
    { tema: 'evidencias', question: '¿Qué diferencia hay entre una constancia y una credencial externa?', answer: 'La constancia la emite la institución sobre una participación confirmada. La credencial externa (un curso, un certificado de otra entidad) la registras tú con sus áreas y tecnologías; suma cuando queda con respaldo.', to: '/student/evidences' },
    { tema: 'evidencias', question: '¿Qué significa «con respaldo»?', answer: 'Que hay algo que lo sostiene además de tu palabra: una evidencia, una confirmación del organizador o la revisión de un docente. «No se pudo comprobar» quiere decir que la verificación automática no encontró el recurso; no es una sanción.' },
    { tema: 'afinidad', question: '¿Por qué mi afinidad no sube si marqué que me interesa un área?', answer: 'Los intereses orientan tus recomendaciones, pero la afinidad solo cuenta lo que hiciste y está respaldado: actividades confirmadas, proyectos y credenciales con respaldo, cada uno en el área que se indicó.', to: '/student/affinity', image: IMG.afinidad },
    { tema: 'afinidad', question: '¿De dónde sale cada punto?', answer: 'En Áreas de afinidad abre un área: el desglose muestra cada actividad, proyecto o credencial que aporta y cuánto.', to: '/student/affinity' },
    { tema: 'curriculo', question: '¿El CV es un documento oficial?', answer: 'No. Resume lo registrado en Afinia y lo dice en el propio PDF. Si usas la ayuda de redacción, nada entra al CV hasta que eliges la propuesta.', to: '/student/progress?tab=resumen' },
    { tema: 'privacidad', question: '¿Quién puede ver mi perfil?', answer: 'Nadie fuera del sistema, salvo que actives tu perfil compartible. Tú eliges qué se muestra; tu correo institucional y tu código no aparecen nunca por omisión.', to: '/student/profile?tab=visibilidad' },
    { tema: 'privacidad', question: '¿Cómo me contactan si no hay chat?', answer: 'Configura tus canales (Teams, WhatsApp, LinkedIn, correo o un enlace) en Colaboración. Tus contactos aceptados los ven; en tu perfil público, solo los que marques.', to: '/student/collaboration' },
  ],
  [RolNombre.TEACHER]: [
    ...CUENTA,
    { tema: 'actividades', question: '¿Qué diferencia hay entre «Mis actividades» y «Actividades de la carrera»?', answer: '«Mis actividades» son las que creaste tú y gestionas. «Actividades de la carrera» son todas las publicadas (de Dirección, Sociedad u otros docentes), para consultarlas; no por verlas pasan a ser tuyas.', to: '/teacher?tab=actividades' },
    { tema: 'actividades', question: '¿Por qué no puedo publicar mi actividad?', answer: 'Las actividades de docentes pasan por Dirección. Envíala a revisión; si te la observan, corrige y reenvíala. Una vez aprobada ya no se edita su contenido.', to: '/teacher/my-activities', image: IMG.actividad },
    { tema: 'gestion', question: '¿Por qué no veo a un estudiante?', answer: 'Solo ves a quienes cursan los semestres que tienes habilitados. Si falta un semestre, pídelo a la administración.', to: '/teacher?tab=estudiantes' },
    { tema: 'proyectos', question: '¿Qué proyectos puedo ver?', answer: 'Los que los estudiantes de tus semestres abrieron a docentes. Puedes dejarles retroalimentación.', to: '/teacher?tab=proyectos', image: IMG.proyecto },
    { tema: 'privacidad', question: '¿Puedo ver datos que el estudiante ocultó?', answer: 'No. Ves lo que el estudiante permite a docentes, y solo de tus semestres.' },
  ],
  [RolNombre.CAREER_DIRECTOR]: [
    ...CUENTA,
    { tema: 'actividades', question: '¿Qué apruebo junto con una actividad?', answer: 'Su contenido, si emite constancia o certificado y cuántos puntos da por participar. Después de aprobarla puedes ajustar sus datos; cada cambio queda auditado.', to: '/director/approvals', image: IMG.actividad },
    { tema: 'evidencias', question: '¿Cuándo se emite una constancia?', answer: 'Solo sobre participación confirmada en actividades que la tienen habilitada.', to: '/director/constancies' },
    { tema: 'afinidad', question: '¿Por qué una fila dice «sin desglose»?', answer: 'Porque el grupo es tan pequeño que el detalle identificaría a las personas. Se muestra el tamaño del grupo y no sus datos.', to: '/director/analytics' },
  ],
  [RolNombre.SCIENTIFIC_SOCIETY]: [
    ...CUENTA,
    { tema: 'actividades', question: '¿Por qué mi actividad sigue en borrador?', answer: 'Hasta que Dirección la aprueba no se puede publicar. Revisa su estado en la columna «Revisión». Para crear una nueva usa el botón «Nueva actividad» de Mis actividades.', to: '/society/activities', image: IMG.actividad },
    { tema: 'actividades', question: '¿Cómo confirmo quién participó?', answer: 'Son dos pasos. Antes del evento admites (o no, con motivo) a quien pidió un lugar; si la actividad es abierta y sin cupo, la admisión es automática. Cuando el evento empezó, marcas Presente o Ausente. Solo la asistencia registrada cuenta para el estudiante.', to: '/society/participants' },
  ],
  [RolNombre.ADMIN]: [
    ...CUENTA,
    { tema: 'cuenta', question: 'Un estudiante no recibió el correo de activación', answer: 'Revisa el estado del envío en Usuarios y reenvía la invitación. Si ningún correo sale, la configuración del servidor de correo es parte del despliegue: avisa a quien administra el servidor.', to: '/admin/users' },
    { tema: 'gestion', question: '¿Cómo cargo estudiantes en lote?', answer: 'En Importar padrón sube la planilla: se valida fila por fila y puedes aplicar las filas válidas aunque otras tengan errores.', to: '/admin/imports' },
    { tema: 'gestion', question: '¿Qué muestra la auditoría?', answer: 'Quién hizo qué, en qué módulo, cuándo y con qué resultado. Puedes filtrar por cada uno; el detalle nunca incluye contraseñas, tokens ni códigos.', to: '/admin/audit' },
  ],
};
