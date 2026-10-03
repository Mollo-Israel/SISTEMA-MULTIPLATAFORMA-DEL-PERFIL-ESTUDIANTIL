import { OnboardingQuestionType } from '@perfil/shared';

/**
 * Banco de preguntas del Cuestionario Inicial de Orientación Académica (§16).
 *
 * §73.2 permite dejar preguntas y opciones versionadas en código siempre que
 * se persistan las ejecuciones, las respuestas y la versión. Se elige esa vía:
 * un cuestionario de orientación cambia en bloque —se revisa entero y se
 * publica una versión nueva—, no opción por opción desde una pantalla de
 * administración, así que una tabla editable ofrecería flexibilidad que nadie
 * va a usar a cambio de un formulario que alguien tendría que mantener.
 *
 * Lo que sí se persiste es todo lo que permite releer un resultado años
 * después: la versión, las respuestas literales y las áreas que salieron.
 *
 * **Al cambiar las preguntas hay que subir `QUESTIONNAIRE_VERSION`.** Las
 * ejecuciones antiguas conservan la suya, de modo que un resultado viejo se
 * sigue interpretando con el cuestionario con el que se respondió.
 */
/**
 * Versión 2: el cuestionario se adapta a las áreas que el estudiante ya
 * declaró (preguntas de profundización) y acepta respuestas parciales a
 * partir de `MIN_ANSWERS`. Las ejecuciones de la versión 1 se conservan y se
 * siguen leyendo con su versión.
 */
export const QUESTIONNAIRE_VERSION = 2;

/**
 * Las opciones no nombran áreas por UUID sino por estas etiquetas, que se
 * resuelven contra el catálogo por nombre o por `tags`. Así el cuestionario no
 * depende de los identificadores de una base de datos concreta y sobrevive a
 * un entorno sembrado de otra forma.
 */
export type AreaTag =
  | 'desarrollo-web'
  | 'desarrollo-movil'
  | 'datos'
  | 'inteligencia-artificial'
  | 'ciberseguridad'
  | 'redes'
  | 'infraestructura'
  | 'videojuegos'
  | 'sistemas-embebidos'
  | 'gestion-proyectos'
  | 'investigacion'
  | 'diseno-ux';

export interface OnboardingOption {
  /** Estable entre versiones mientras la opción signifique lo mismo. */
  code: string;
  label: string;
  /** Áreas que esta respuesta sugiere, con su peso relativo. */
  areas: { tag: AreaTag; weight: number }[];
}

export interface OnboardingQuestion {
  code: string;
  text: string;
  help?: string;
  type: OnboardingQuestionType;
  /** Solo para `MULTIPLE`: cuántas opciones puede marcar como máximo. */
  maxChoices?: number;
  options: OnboardingOption[];
}

const single = (
  code: string,
  text: string,
  options: OnboardingOption[],
  help?: string,
): OnboardingQuestion => ({ code, text, help, type: OnboardingQuestionType.SINGLE, options });

const multiple = (
  code: string,
  text: string,
  maxChoices: number,
  options: OnboardingOption[],
  help?: string,
): OnboardingQuestion => ({
  code,
  text,
  help,
  type: OnboardingQuestionType.MULTIPLE,
  maxChoices,
  options,
});

/**
 * Doce preguntas, dentro del rango de 10–15 que fija §16.
 *
 * Ninguna pregunta por conocimiento técnico: todas preguntan por preferencia,
 * gusto o forma de trabajar. Un cuestionario que preguntara «¿sabes qué es una
 * clave foránea?» estaría evaluando, que es justo lo que §16 prohíbe.
 */
export const QUESTIONNAIRE: OnboardingQuestion[] = [
  single(
    'q01_producto_favorito',
    'De lo que usas a diario, ¿qué te da más curiosidad por dentro?',
    [
      { code: 'web', label: 'Una página o aplicación web', areas: [{ tag: 'desarrollo-web', weight: 3 }, { tag: 'diseno-ux', weight: 1 }] },
      { code: 'app', label: 'Una aplicación del teléfono', areas: [{ tag: 'desarrollo-movil', weight: 3 }, { tag: 'diseno-ux', weight: 1 }] },
      { code: 'juego', label: 'Un videojuego', areas: [{ tag: 'videojuegos', weight: 3 }] },
      { code: 'asistente', label: 'Un asistente que responde solo', areas: [{ tag: 'inteligencia-artificial', weight: 3 }, { tag: 'datos', weight: 1 }] },
      { code: 'dispositivo', label: 'Un dispositivo físico conectado', areas: [{ tag: 'sistemas-embebidos', weight: 3 }, { tag: 'redes', weight: 1 }] },
    ],
  ),

  single(
    'q02_problema_preferido',
    'Ante un problema nuevo, ¿qué prefieres hacer primero?',
    [
      { code: 'prototipo', label: 'Montar algo que funcione y verlo en pantalla', areas: [{ tag: 'desarrollo-web', weight: 2 }, { tag: 'desarrollo-movil', weight: 2 }] },
      { code: 'datos', label: 'Buscar datos y mirar qué dicen', areas: [{ tag: 'datos', weight: 3 }, { tag: 'investigacion', weight: 1 }] },
      { code: 'romper', label: 'Intentar romperlo para ver dónde falla', areas: [{ tag: 'ciberseguridad', weight: 3 }] },
      { code: 'plan', label: 'Ordenar el trabajo y repartir tareas', areas: [{ tag: 'gestion-proyectos', weight: 3 }] },
      { code: 'leer', label: 'Leer qué se ha hecho antes', areas: [{ tag: 'investigacion', weight: 3 }] },
    ],
  ),

  multiple(
    'q03_materias',
    '¿Qué materias has disfrutado más hasta ahora?',
    3,
    [
      { code: 'programacion', label: 'Programación', areas: [{ tag: 'desarrollo-web', weight: 2 }, { tag: 'desarrollo-movil', weight: 2 }] },
      { code: 'bases_datos', label: 'Bases de datos', areas: [{ tag: 'datos', weight: 3 }] },
      { code: 'matematicas', label: 'Matemáticas y estadística', areas: [{ tag: 'inteligencia-artificial', weight: 2 }, { tag: 'datos', weight: 2 }] },
      { code: 'redes_materia', label: 'Redes y comunicaciones', areas: [{ tag: 'redes', weight: 3 }, { tag: 'infraestructura', weight: 1 }] },
      { code: 'arquitectura', label: 'Arquitectura de computadoras', areas: [{ tag: 'sistemas-embebidos', weight: 3 }] },
      { code: 'ingenieria_sw', label: 'Ingeniería de software', areas: [{ tag: 'gestion-proyectos', weight: 2 }, { tag: 'desarrollo-web', weight: 1 }] },
    ],
    'Puedes elegir hasta tres.',
  ),

  single(
    'q04_forma_trabajo',
    '¿Con qué te sientes más cómodo?',
    [
      { code: 'visual', label: 'Trabajar en lo que se ve y se toca', areas: [{ tag: 'diseno-ux', weight: 3 }, { tag: 'desarrollo-web', weight: 2 }] },
      { code: 'logica', label: 'Trabajar en la lógica de detrás', areas: [{ tag: 'desarrollo-web', weight: 2 }, { tag: 'datos', weight: 2 }] },
      { code: 'sistemas', label: 'Trabajar en servidores y despliegues', areas: [{ tag: 'infraestructura', weight: 3 }, { tag: 'redes', weight: 1 }] },
      { code: 'analisis', label: 'Trabajar con números y modelos', areas: [{ tag: 'datos', weight: 3 }, { tag: 'inteligencia-artificial', weight: 2 }] },
    ],
  ),

  single(
    'q05_noticia',
    '¿Qué titular leerías completo?',
    [
      { code: 'ia', label: '«Un modelo aprende a diagnosticar con radiografías»', areas: [{ tag: 'inteligencia-artificial', weight: 3 }] },
      { code: 'brecha', label: '«Filtran los datos de millones de usuarios»', areas: [{ tag: 'ciberseguridad', weight: 3 }] },
      { code: 'lanzamiento', label: '«Una app boliviana llega a cien mil descargas»', areas: [{ tag: 'desarrollo-movil', weight: 3 }] },
      { code: 'satelite', label: '«Un satélite universitario transmite sus primeros datos»', areas: [{ tag: 'sistemas-embebidos', weight: 2 }, { tag: 'redes', weight: 2 }] },
      { code: 'estudio', label: '«Un estudio revela cómo estudian los universitarios»', areas: [{ tag: 'investigacion', weight: 2 }, { tag: 'datos', weight: 2 }] },
    ],
  ),

  multiple(
    'q06_proyecto_sonado',
    'Si pudieras construir cualquier cosa este semestre, ¿qué sería?',
    2,
    [
      { code: 'plataforma', label: 'Una plataforma que use mucha gente', areas: [{ tag: 'desarrollo-web', weight: 3 }] },
      { code: 'app_util', label: 'Una app que resuelva algo cotidiano', areas: [{ tag: 'desarrollo-movil', weight: 3 }] },
      { code: 'modelo', label: 'Un modelo que prediga algo', areas: [{ tag: 'inteligencia-artificial', weight: 3 }, { tag: 'datos', weight: 1 }] },
      { code: 'juego_propio', label: 'Un videojuego', areas: [{ tag: 'videojuegos', weight: 3 }] },
      { code: 'robot', label: 'Un robot o un dispositivo', areas: [{ tag: 'sistemas-embebidos', weight: 3 }] },
      { code: 'auditoria', label: 'Una herramienta de seguridad', areas: [{ tag: 'ciberseguridad', weight: 3 }] },
    ],
    'Puedes elegir hasta dos.',
  ),

  single(
    'q07_equipo',
    'En un trabajo en grupo, ¿qué papel acabas tomando?',
    [
      { code: 'organizo', label: 'Organizo y reparto el trabajo', areas: [{ tag: 'gestion-proyectos', weight: 3 }] },
      { code: 'construyo', label: 'Me pongo a construir', areas: [{ tag: 'desarrollo-web', weight: 2 }, { tag: 'desarrollo-movil', weight: 1 }] },
      { code: 'investigo', label: 'Investigo y documento', areas: [{ tag: 'investigacion', weight: 3 }] },
      { code: 'presento', label: 'Preparo cómo se ve y se presenta', areas: [{ tag: 'diseno-ux', weight: 3 }] },
      { code: 'reviso', label: 'Reviso que nada se rompa', areas: [{ tag: 'ciberseguridad', weight: 2 }, { tag: 'infraestructura', weight: 1 }] },
    ],
  ),

  single(
    'q08_ritmo',
    '¿Qué te motiva más?',
    [
      { code: 'resultado_rapido', label: 'Ver resultados rápido', areas: [{ tag: 'desarrollo-web', weight: 2 }, { tag: 'desarrollo-movil', weight: 2 }] },
      { code: 'profundizar', label: 'Entender algo a fondo aunque tarde', areas: [{ tag: 'investigacion', weight: 3 }, { tag: 'inteligencia-artificial', weight: 1 }] },
      { code: 'estabilidad', label: 'Que lo que hago sea estable y no falle', areas: [{ tag: 'infraestructura', weight: 3 }] },
      { code: 'creatividad', label: 'Tener libertad creativa', areas: [{ tag: 'videojuegos', weight: 2 }, { tag: 'diseno-ux', weight: 2 }] },
    ],
  ),

  multiple(
    'q09_herramientas',
    '¿Con qué has trasteado alguna vez, aunque sea poco?',
    3,
    [
      { code: 'paginas', label: 'Hacer páginas web', areas: [{ tag: 'desarrollo-web', weight: 2 }] },
      { code: 'excel_datos', label: 'Hojas de cálculo o consultas de datos', areas: [{ tag: 'datos', weight: 2 }] },
      { code: 'linux', label: 'Linux, terminal o servidores', areas: [{ tag: 'infraestructura', weight: 2 }, { tag: 'redes', weight: 1 }] },
      { code: 'arduino', label: 'Arduino, Raspberry o similares', areas: [{ tag: 'sistemas-embebidos', weight: 2 }] },
      { code: 'motor_juegos', label: 'Unity, Godot o motores de juego', areas: [{ tag: 'videojuegos', weight: 2 }] },
      { code: 'figma', label: 'Figma o herramientas de diseño', areas: [{ tag: 'diseno-ux', weight: 2 }] },
      { code: 'nada', label: 'Todavía con nada', areas: [] },
    ],
    'Puedes elegir hasta tres. No pasa nada si es ninguna.',
  ),

  single(
    'q10_impacto',
    '¿Qué tipo de impacto te gustaría tener?',
    [
      { code: 'personas', label: 'Que mucha gente use lo que hago', areas: [{ tag: 'desarrollo-web', weight: 2 }, { tag: 'desarrollo-movil', weight: 2 }] },
      { code: 'conocimiento', label: 'Aportar conocimiento nuevo', areas: [{ tag: 'investigacion', weight: 3 }] },
      { code: 'proteger', label: 'Proteger información y personas', areas: [{ tag: 'ciberseguridad', weight: 3 }] },
      { code: 'decisiones', label: 'Ayudar a tomar mejores decisiones', areas: [{ tag: 'datos', weight: 3 }] },
      { code: 'equipos', label: 'Hacer que los equipos funcionen', areas: [{ tag: 'gestion-proyectos', weight: 3 }] },
    ],
  ),

  single(
    'q11_dificultad',
    '¿Qué te frustra menos?',
    [
      { code: 'bug', label: 'Perseguir un error durante horas', areas: [{ tag: 'desarrollo-web', weight: 2 }, { tag: 'ciberseguridad', weight: 1 }] },
      { code: 'datos_sucios', label: 'Limpiar datos desordenados', areas: [{ tag: 'datos', weight: 3 }] },
      { code: 'config', label: 'Pelear con configuraciones y despliegues', areas: [{ tag: 'infraestructura', weight: 3 }, { tag: 'redes', weight: 1 }] },
      { code: 'iterar_diseno', label: 'Rehacer un diseño muchas veces', areas: [{ tag: 'diseno-ux', weight: 3 }] },
      { code: 'leer_papers', label: 'Leer documentación densa', areas: [{ tag: 'investigacion', weight: 3 }] },
    ],
  ),

  multiple(
    'q12_explorar',
    '¿Qué te gustaría explorar este año, aunque no sepas nada aún?',
    3,
    [
      { code: 'ia_explorar', label: 'Inteligencia artificial', areas: [{ tag: 'inteligencia-artificial', weight: 2 }] },
      { code: 'seguridad_explorar', label: 'Ciberseguridad', areas: [{ tag: 'ciberseguridad', weight: 2 }] },
      { code: 'nube_explorar', label: 'Nube e infraestructura', areas: [{ tag: 'infraestructura', weight: 2 }] },
      { code: 'redes_explorar', label: 'Redes', areas: [{ tag: 'redes', weight: 2 }] },
      { code: 'movil_explorar', label: 'Desarrollo móvil', areas: [{ tag: 'desarrollo-movil', weight: 2 }] },
      { code: 'juegos_explorar', label: 'Videojuegos', areas: [{ tag: 'videojuegos', weight: 2 }] },
      { code: 'gestion_explorar', label: 'Gestión de proyectos', areas: [{ tag: 'gestion-proyectos', weight: 2 }] },
    ],
    'Puedes elegir hasta tres.',
  ),
];

/**
 * Preguntas de profundización, una por área (versión 2).
 *
 * El cuestionario se responde **después** de declarar áreas de mejora e
 * intereses. Preguntarle a quien ya dijo «me interesa la ciberseguridad» si le
 * interesa la ciberseguridad no aporta nada; preguntarle qué lado de la
 * ciberseguridad le atrae sí, y de paso descubre áreas vecinas. `{area}` se
 * sustituye por el nombre del área tal como la llama la carrera.
 */
export const DEEP_DIVES: Record<AreaTag, OnboardingQuestion> = {
  'desarrollo-web': single('dd_desarrollo_web', 'Dijiste que te interesa {area}. ¿Qué parte te llama más?', [
    { code: 'interfaces', label: 'Las pantallas: que se vean bien y se entiendan', areas: [{ tag: 'diseno-ux', weight: 2 }, { tag: 'desarrollo-web', weight: 2 }] },
    { code: 'servidor', label: 'Lo que no se ve: servidores, APIs y datos', areas: [{ tag: 'desarrollo-web', weight: 3 }, { tag: 'datos', weight: 1 }] },
    { code: 'rendimiento', label: 'Que sea rápido y seguro', areas: [{ tag: 'ciberseguridad', weight: 2 }, { tag: 'infraestructura', weight: 1 }, { tag: 'desarrollo-web', weight: 1 }] },
    { code: 'todo_web', label: 'Todavía no lo sé: quiero probar un poco de todo', areas: [{ tag: 'desarrollo-web', weight: 2 }] },
  ]),
  'desarrollo-movil': single('dd_desarrollo_movil', 'En {area}, ¿qué te gustaría lograr?', [
    { code: 'cotidiana', label: 'Una app útil para el día a día', areas: [{ tag: 'desarrollo-movil', weight: 3 }, { tag: 'diseno-ux', weight: 1 }] },
    { code: 'sensores', label: 'Una app que use la cámara, el GPS o los sensores', areas: [{ tag: 'desarrollo-movil', weight: 2 }, { tag: 'sistemas-embebidos', weight: 2 }] },
    { code: 'offline', label: 'Una app que funcione sin internet y se sincronice', areas: [{ tag: 'desarrollo-movil', weight: 2 }, { tag: 'datos', weight: 1 }, { tag: 'infraestructura', weight: 1 }] },
    { code: 'juego_movil', label: 'Un juego para el teléfono', areas: [{ tag: 'videojuegos', weight: 3 }, { tag: 'desarrollo-movil', weight: 1 }] },
  ]),
  datos: single('dd_datos', 'Con {area}, ¿qué te atrae más?', [
    { code: 'ordenar', label: 'Que la información esté bien guardada y ordenada', areas: [{ tag: 'datos', weight: 3 }] },
    { code: 'patrones', label: 'Descubrir patrones y tendencias', areas: [{ tag: 'datos', weight: 2 }, { tag: 'inteligencia-artificial', weight: 2 }] },
    { code: 'visualizar', label: 'Contar historias con gráficos', areas: [{ tag: 'datos', weight: 2 }, { tag: 'diseno-ux', weight: 1 }] },
    { code: 'escala', label: 'Que miles de consultas respondan al instante', areas: [{ tag: 'datos', weight: 2 }, { tag: 'infraestructura', weight: 2 }] },
  ]),
  'inteligencia-artificial': single('dd_inteligencia_artificial', 'En {area}, ¿qué te gustaría construir?', [
    { code: 'lenguaje', label: 'Algo que entienda texto o voz', areas: [{ tag: 'inteligencia-artificial', weight: 3 }] },
    { code: 'vision', label: 'Algo que reconozca imágenes', areas: [{ tag: 'inteligencia-artificial', weight: 3 }, { tag: 'sistemas-embebidos', weight: 1 }] },
    { code: 'predecir', label: 'Algo que recomiende o anticipe', areas: [{ tag: 'inteligencia-artificial', weight: 2 }, { tag: 'datos', weight: 2 }] },
    { code: 'por_dentro', label: 'Entender cómo funciona por dentro', areas: [{ tag: 'inteligencia-artificial', weight: 2 }, { tag: 'investigacion', weight: 2 }] },
  ]),
  ciberseguridad: single('dd_ciberseguridad', 'En {area}, ¿qué lado te atrae?', [
    { code: 'atacar', label: 'Encontrar fallos antes que los malos', areas: [{ tag: 'ciberseguridad', weight: 3 }] },
    { code: 'defender', label: 'Proteger redes y servidores', areas: [{ tag: 'ciberseguridad', weight: 2 }, { tag: 'redes', weight: 2 }] },
    { code: 'forense', label: 'Investigar qué pasó tras un incidente', areas: [{ tag: 'ciberseguridad', weight: 2 }, { tag: 'investigacion', weight: 1 }, { tag: 'datos', weight: 1 }] },
    { code: 'codigo_seguro', label: 'Escribir software seguro desde el principio', areas: [{ tag: 'ciberseguridad', weight: 2 }, { tag: 'desarrollo-web', weight: 2 }] },
  ]),
  redes: single('dd_redes', 'En {area}, ¿qué te gustaría dominar?', [
    { code: 'disenar_red', label: 'Diseñar y configurar redes', areas: [{ tag: 'redes', weight: 3 }] },
    { code: 'conectar', label: 'Conectar dispositivos entre sí', areas: [{ tag: 'redes', weight: 2 }, { tag: 'sistemas-embebidos', weight: 2 }] },
    { code: 'nube_red', label: 'Servicios en la nube', areas: [{ tag: 'infraestructura', weight: 3 }, { tag: 'redes', weight: 1 }] },
    { code: 'trafico', label: 'Proteger el tráfico de la red', areas: [{ tag: 'redes', weight: 2 }, { tag: 'ciberseguridad', weight: 2 }] },
  ]),
  infraestructura: single('dd_infraestructura', 'En {area}, ¿qué te atrae?', [
    { code: 'automatizar', label: 'Automatizar despliegues', areas: [{ tag: 'infraestructura', weight: 3 }, { tag: 'gestion-proyectos', weight: 1 }] },
    { code: 'aguantar', label: 'Que un sistema aguante a muchísima gente', areas: [{ tag: 'infraestructura', weight: 3 }, { tag: 'desarrollo-web', weight: 1 }] },
    { code: 'servidores', label: 'Administrar servidores Linux', areas: [{ tag: 'infraestructura', weight: 2 }, { tag: 'redes', weight: 1 }] },
    { code: 'costos', label: 'Vigilar costos y monitoreo', areas: [{ tag: 'infraestructura', weight: 2 }, { tag: 'gestion-proyectos', weight: 2 }] },
  ]),
  videojuegos: single('dd_videojuegos', 'En {area}, ¿qué parte te gustaría hacer?', [
    { code: 'jugabilidad', label: 'Programar cómo se juega', areas: [{ tag: 'videojuegos', weight: 3 }] },
    { code: 'niveles', label: 'Diseñar niveles y experiencia', areas: [{ tag: 'videojuegos', weight: 2 }, { tag: 'diseno-ux', weight: 2 }] },
    { code: 'graficos', label: 'Gráficos y animación', areas: [{ tag: 'videojuegos', weight: 3 }, { tag: 'diseno-ux', weight: 1 }] },
    { code: 'en_linea', label: 'Juegos en línea', areas: [{ tag: 'videojuegos', weight: 2 }, { tag: 'redes', weight: 2 }] },
  ]),
  'sistemas-embebidos': single('dd_sistemas_embebidos', 'Con {area}, ¿qué te llama?', [
    { code: 'robots', label: 'Construir robots', areas: [{ tag: 'sistemas-embebidos', weight: 3 }] },
    { code: 'iot', label: 'Sensores conectados a internet', areas: [{ tag: 'sistemas-embebidos', weight: 2 }, { tag: 'redes', weight: 2 }] },
    { code: 'domotica', label: 'Automatizar cosas de la casa', areas: [{ tag: 'sistemas-embebidos', weight: 2 }, { tag: 'desarrollo-movil', weight: 1 }] },
    { code: 'autonomos', label: 'Drones o vehículos autónomos', areas: [{ tag: 'sistemas-embebidos', weight: 3 }, { tag: 'inteligencia-artificial', weight: 1 }] },
  ]),
  'gestion-proyectos': single('dd_gestion_proyectos', 'En {area}, ¿qué te sale mejor?', [
    { code: 'planificar', label: 'Planificar y medir el avance', areas: [{ tag: 'gestion-proyectos', weight: 3 }] },
    { code: 'coordinar', label: 'Coordinar a las personas', areas: [{ tag: 'gestion-proyectos', weight: 3 }] },
    { code: 'agil', label: 'Aplicar metodologías ágiles', areas: [{ tag: 'gestion-proyectos', weight: 2 }, { tag: 'desarrollo-web', weight: 1 }] },
    { code: 'calidad', label: 'Cuidar la calidad y las pruebas', areas: [{ tag: 'gestion-proyectos', weight: 2 }, { tag: 'ciberseguridad', weight: 1 }] },
  ]),
  investigacion: single('dd_investigacion', 'En {area}, ¿qué te gustaría hacer?', [
    { code: 'publicar', label: 'Escribir y publicar artículos', areas: [{ tag: 'investigacion', weight: 3 }] },
    { code: 'experimentar', label: 'Experimentar con tecnologías nuevas', areas: [{ tag: 'investigacion', weight: 2 }, { tag: 'inteligencia-artificial', weight: 1 }] },
    { code: 'estudio_datos', label: 'Analizar los datos de un estudio', areas: [{ tag: 'investigacion', weight: 2 }, { tag: 'datos', weight: 2 }] },
    { code: 'problema_real', label: 'Resolver un problema real de una organización', areas: [{ tag: 'investigacion', weight: 2 }, { tag: 'gestion-proyectos', weight: 1 }] },
  ]),
  'diseno-ux': single('dd_diseno_ux', 'En {area}, ¿qué te atrae?', [
    { code: 'facil', label: 'Que una aplicación sea fácil de usar', areas: [{ tag: 'diseno-ux', weight: 3 }] },
    { code: 'pantallas', label: 'Dibujar pantallas e interfaces', areas: [{ tag: 'diseno-ux', weight: 3 }, { tag: 'desarrollo-web', weight: 1 }] },
    { code: 'usuarios', label: 'Hablar con usuarios para entenderlos', areas: [{ tag: 'diseno-ux', weight: 2 }, { tag: 'investigacion', weight: 2 }] },
    { code: 'detalles', label: 'Animaciones y detalles visuales', areas: [{ tag: 'diseno-ux', weight: 2 }, { tag: 'videojuegos', weight: 1 }] },
  ]),
};

/** Mínimo de respuestas para calcular sugerencias: con menos, orientarían mal. */
export const MIN_ANSWERS = 6;

/** Cuántas áreas declaradas reciben pregunta propia. */
const MAX_DEEP_DIVES = 4;

/** Las ocho preguntas generales que siempre van. */
const NUCLEO = QUESTIONNAIRE.slice(0, 8);

/**
 * El cuestionario de un estudiante concreto.
 *
 * Sin áreas declaradas, el general completo (12). Con áreas, primero una
 * pregunta por cada una de sus áreas (hasta cuatro), luego las ocho generales,
 * y se rellena con las restantes hasta llegar a diez: siempre entre 10 y 12
 * preguntas, dentro del rango de §16.
 */
export function buildQuestionnaire(declaradas: AreaTag[]): OnboardingQuestion[] {
  const tags = [...new Set(declaradas)].slice(0, MAX_DEEP_DIVES);
  if (tags.length === 0) return QUESTIONNAIRE;
  const propias = tags.map((t) => DEEP_DIVES[t]);
  const resto = QUESTIONNAIRE.slice(NUCLEO.length);
  const relleno = resto.slice(0, Math.max(0, 10 - NUCLEO.length - propias.length));
  return [...propias, ...NUCLEO, ...relleno];
}

/**
 * Índice por código de todo el banco, para validar respuestas sin recorrerlo.
 * Incluye las de profundización: cualquiera de ellas pudo haberse servido.
 */
export const QUESTION_BY_CODE = new Map(
  [...QUESTIONNAIRE, ...Object.values(DEEP_DIVES)].map((q) => [q.code, q]),
);

/**
 * Sinónimos con los que se busca cada etiqueta en el catálogo de áreas.
 *
 * El catálogo lo administra la carrera y sus nombres no están bajo el control
 * de este archivo, así que se intenta por varios términos. Una etiqueta que no
 * encuentre ninguna área simplemente no sugiere nada: es preferible sugerir de
 * menos que inventar un área que la carrera no ofrece.
 */
export const AREA_SYNONYMS: Record<AreaTag, string[]> = {
  'desarrollo-web': ['web', 'desarrollo web', 'frontend', 'backend', 'full stack'],
  'desarrollo-movil': ['móvil', 'movil', 'mobile', 'aplicaciones móviles'],
  datos: ['datos', 'data', 'base de datos', 'bases de datos', 'ciencia de datos', 'analítica'],
  'inteligencia-artificial': ['inteligencia artificial', 'ia', 'machine learning', 'aprendizaje automático'],
  ciberseguridad: ['ciberseguridad', 'seguridad', 'security', 'seguridad informática'],
  redes: ['redes', 'networking', 'telecomunicaciones'],
  infraestructura: ['infraestructura', 'nube', 'cloud', 'devops', 'sistemas operativos'],
  videojuegos: ['videojuegos', 'juegos', 'gaming', 'game'],
  'sistemas-embebidos': ['embebidos', 'iot', 'internet de las cosas', 'robótica', 'hardware'],
  'gestion-proyectos': ['gestión', 'gestion de proyectos', 'ingeniería de software', 'project management'],
  investigacion: ['investigación', 'investigacion', 'research', 'académica'],
  'diseno-ux': ['diseño', 'ux', 'ui', 'experiencia de usuario', 'interfaces'],
};
