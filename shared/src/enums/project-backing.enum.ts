/**
 * Nivel de respaldo de un proyecto (especificacion §36).
 *
 * Es una escala de corroboracion tecnica, no de calidad academica. Un proyecto
 * `DECLARED` puede ser excelente: solo significa que, hasta ahora, lo unico que
 * existe es lo que su autor escribio.
 *
 * Se deriva de senales observables, nunca se fija a mano.
 */
export enum ProjectBackingTier {
  /** Solo informacion declarada. Es donde nace todo proyecto (§32). */
  DECLARED = 'declared',
  /** Hay al menos una fuente adicional: integrante, evidencia, repo o demo. */
  SUPPORTED = 'supported',
  /** Dos senales independientes y una corroboracion tecnica relevante. */
  CORROBORATED = 'corroborated',
  /**
   * Al menos SUPPORTED y con retroalimentacion docente.
   *
   * **No significa «aprobado academicamente»** (§36). Significa que alguien con
   * criterio lo miro y dejo constancia.
   */
  REVIEWED = 'reviewed',
  /**
   * Hay una inconsistencia grave: enlace bloqueado, recurso eliminado,
   * duplicacion sospechosa o metadata incompatible.
   *
   * El proyecto **no se elimina** (§36). Se marca para que quien lo mire sepa
   * que algo no cuadra.
   */
  FLAGGED = 'flagged',
}

/**
 * Orden de menor a mayor respaldo.
 *
 * `FLAGGED` queda fuera a proposito: no es un escalon mas alto ni mas bajo,
 * es una advertencia que convive con cualquier nivel.
 */
export const PROJECT_BACKING_ORDER: readonly ProjectBackingTier[] = [
  ProjectBackingTier.DECLARED,
  ProjectBackingTier.SUPPORTED,
  ProjectBackingTier.CORROBORATED,
  ProjectBackingTier.REVIEWED,
];

/**
 * Situacion de una tecnologia declarada en un proyecto (§38).
 *
 * `DETECTED` significa que se encontraron indicios compatibles en fuentes
 * publicas —un manifiesto, los lenguajes que reporta GitHub—, **no** que el
 * estudiante domine esa tecnologia.
 */
export enum TechnologyStatus {
  /** El estudiante la declaro y no se encontro rastro publico. */
  DECLARED = 'declared',
  /** Se encontro en el repositorio pero el estudiante no la declaro. */
  DETECTED = 'detected',
  /** Declarada y encontrada. Es la unica que corrobora algo. */
  BOTH = 'both',
}

/**
 * Bitacora de proyecto (§41).
 *
 * La auditoria funcional se hace con eventos estructurados, no leyendo
 * conversaciones. Cada evento guarda su actor y un metadato minimo; nunca
 * secretos.
 */
export enum ProjectEventType {
  PROJECT_CREATED = 'project_created',
  MEMBER_INVITED = 'member_invited',
  MEMBER_ACCEPTED = 'member_accepted',
  MEMBER_DECLINED = 'member_declined',
  MEMBER_REMOVED = 'member_removed',
  CONTRIBUTION_UPDATED = 'contribution_updated',
  CONTRIBUTION_CONFIRMED = 'contribution_confirmed',
  EVIDENCE_ADDED = 'evidence_added',
  EVIDENCE_REMOVED = 'evidence_removed',
  REPOSITORY_CHECKED = 'repository_checked',
  DEMO_CHECKED = 'demo_checked',
  FEEDBACK_ADDED = 'feedback_added',
  PROJECT_VISIBILITY_CHANGED = 'project_visibility_changed',
  PROJECT_ARCHIVED = 'project_archived',
  /** V3 §22: pasó a ACTIVE cumpliendo los requisitos. */
  PROJECT_ACTIVATED = 'project_activated',
  /** V3 §30: el integrante pide corregir lo que le propusieron. */
  CONTRIBUTION_CORRECTION_REQUESTED = 'contribution_correction_requested',
  BACKING_TIER_CHANGED = 'backing_tier_changed',
}

export const PROJECT_EVENT_LABEL: Record<ProjectEventType, string> = {
  [ProjectEventType.PROJECT_CREATED]: 'Proyecto creado',
  [ProjectEventType.MEMBER_INVITED]: 'Integrante invitado',
  [ProjectEventType.MEMBER_ACCEPTED]: 'Invitación aceptada',
  [ProjectEventType.MEMBER_DECLINED]: 'Invitación rechazada',
  [ProjectEventType.MEMBER_REMOVED]: 'Integrante retirado',
  [ProjectEventType.CONTRIBUTION_UPDATED]: 'Contribución actualizada',
  [ProjectEventType.CONTRIBUTION_CONFIRMED]: 'Contribución confirmada',
  [ProjectEventType.EVIDENCE_ADDED]: 'Evidencia añadida',
  [ProjectEventType.EVIDENCE_REMOVED]: 'Evidencia retirada',
  [ProjectEventType.REPOSITORY_CHECKED]: 'Repositorio comprobado',
  [ProjectEventType.DEMO_CHECKED]: 'Demo comprobada',
  [ProjectEventType.FEEDBACK_ADDED]: 'Retroalimentación docente',
  [ProjectEventType.PROJECT_VISIBILITY_CHANGED]: 'Visibilidad cambiada',
  [ProjectEventType.PROJECT_ARCHIVED]: 'Proyecto archivado',
  [ProjectEventType.PROJECT_ACTIVATED]: 'Proyecto activado',
  [ProjectEventType.CONTRIBUTION_CORRECTION_REQUESTED]: 'Corrección de contribución pedida',
  [ProjectEventType.BACKING_TIER_CHANGED]: 'Nivel de respaldo recalculado',
};

/**
 * Roles de proyecto (V3 §30.1): catálogo controlado y amigable. El rol
 * describe; nunca es fuente de afinidad (lo son las skills corroboradas).
 */
export const PROJECT_ROLES = [
  'Responsable',
  'Frontend',
  'Backend',
  'Base de Datos',
  'Mobile',
  'QA',
  'UX/UI',
  'DevOps',
  'Datos/IA',
  'Documentación',
  'Otro',
] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/**
 * Respaldo de cada tecnología de un proyecto (V3 §24.4, §29).
 *
 * Lo que no se detecta queda DECLARED: no es falso ni resta. El repositorio
 * puede no dejar rastro de Redis y aun así haberse usado.
 */
export enum ProjectSkillEvidenceStatus {
  DECLARED = 'declared',
  CORROBORATED_BY_GITHUB_LANGUAGE = 'corroborated_by_github_language',
  CORROBORATED_BY_MANIFEST = 'corroborated_by_manifest',
  /** Un docente autorizado la confirmó con retroalimentación específica (§29). */
  CORROBORATED_BY_ACADEMIC_REVIEW = 'corroborated_by_academic_review',
}
