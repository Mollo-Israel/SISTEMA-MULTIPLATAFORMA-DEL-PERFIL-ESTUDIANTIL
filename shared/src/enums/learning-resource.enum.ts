/**
 * Catálogo controlado de recursos y cursos externos (especificación §61).
 *
 * §61 es tajante: *«No recomendar URLs arbitrarias obtenidas automáticamente de
 * Internet. Usar catálogo controlado»*. Un recurso entra porque alguien de la
 * carrera lo revisó y decidió incluirlo, no porque un buscador lo devolviera.
 *
 * Hasta aquí, los recursos y los cursos externos se modelaban como
 * *actividades* con una categoría especial. Nunca encajaron: un recurso no
 * tiene fecha, ni cupo, ni inscripción, ni participación que confirmar. Los 71
 * que existían en la base no tenían una sola inscripción, que es la prueba de
 * que nadie los trataba como actividades.
 */

/**
 * Qué clase de material es.
 *
 * `EXTERNAL_COURSE` es el único que la recomendación presenta como curso
 * externo; el resto son recursos de apoyo. La distinción existe porque §61 y
 * RN-16 los nombran por separado, y porque un curso pide una dedicación que
 * una guía de consulta no pide.
 */
export enum LearningResourceType {
  /** Curso de una plataforma o institución externa. */
  EXTERNAL_COURSE = 'external_course',
  /** Documentación oficial de una tecnología. */
  DOCUMENTATION = 'documentation',
  /** Guía, tutorial o artículo explicativo. */
  GUIDE = 'guide',
  /** Video o serie de videos. */
  VIDEO = 'video',
  /** Libro o capítulo. */
  BOOK = 'book',
  /** Herramienta o entorno para practicar. */
  TOOL = 'tool',
  /** Ejercicios, retos o laboratorios para construir experiencia. */
  PRACTICE = 'practice',
}

/**
 * Situación del recurso en el catálogo (§61).
 *
 * *«Un recurso inactivo no se recomienda, pero se conserva históricamente»*.
 * Por eso hay un estado y no un borrado: una recomendación de hace seis meses
 * debe seguir pudiendo explicar a qué apuntaba.
 */
export enum LearningResourceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export const LEARNING_RESOURCE_TYPE_LABEL: Record<LearningResourceType, string> = {
  [LearningResourceType.EXTERNAL_COURSE]: 'Curso externo',
  [LearningResourceType.DOCUMENTATION]: 'Documentación',
  [LearningResourceType.GUIDE]: 'Guía o tutorial',
  [LearningResourceType.VIDEO]: 'Video',
  [LearningResourceType.BOOK]: 'Libro',
  [LearningResourceType.TOOL]: 'Herramienta',
  [LearningResourceType.PRACTICE]: 'Práctica o reto',
};

/**
 * Tipos que sirven para **construir experiencia** (§59).
 *
 * §59 pide que, ante afinidad alta con respaldo bajo, se recomiende «actividades
 * prácticas, proyectos y recursos para construir experiencia». Leer
 * documentación no construye experiencia demostrable; hacer un laboratorio sí.
 */
export const HANDS_ON_RESOURCE_TYPES: readonly LearningResourceType[] = [
  LearningResourceType.PRACTICE,
  LearningResourceType.TOOL,
  LearningResourceType.EXTERNAL_COURSE,
];
