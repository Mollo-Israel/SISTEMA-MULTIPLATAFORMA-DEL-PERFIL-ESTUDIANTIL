/**
 * Nivel de visibilidad de un proyecto del portafolio (RF13, V3 §40).
 *
 * De más cerrado a más abierto:
 *
 *  - PRIVATE      Solo el responsable y los integrantes del proyecto.
 *  - TEAM         Además, los integrantes del equipo de colaboración con el
 *                 que se creó el proyecto (`team_id`, §21.1).
 *  - TEACHERS     Además, el docente de su alcance académico abre el detalle y
 *                 registra retroalimentación (RF16).
 *  - PROFILE      Aparece en el perfil dinámico del estudiante.
 *  - PUBLIC_LINK  Cualquiera con el enlace ve un resumen público: nunca la
 *                 bitácora, la auditoría ni datos privados (§40).
 */
export enum ProjectVisibility {
  PRIVATE = 'private',
  TEAM = 'team',
  PROFILE = 'profile',
  TEACHERS = 'teachers',
  PUBLIC_LINK = 'public_link',
}

/**
 * Estado de una invitacion a integrar un proyecto (RF14).
 *
 * El estudiante invitado solo pasa a ser integrante cuando ACEPTA. Una
 * invitacion rechazada o cancelada no genera participacion alguna.
 */
export enum ProjectInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}
