/**
 * Nivel de visibilidad de un proyecto del portafolio (RF13).
 *
 * El documento pide un "nivel de visibilidad" y condiciona la consulta docente
 * a que el proyecto este "habilitado para consulta" (RF15, Tabla 2.24). Se
 * modela con tres niveles, de mas cerrado a mas abierto:
 *
 *  - PRIVATE   Solo el estudiante responsable y los integrantes aceptados.
 *              No aparece en el perfil que consultan los roles institucionales.
 *  - PROFILE   Aparece en el perfil dinamico del estudiante y en la vista
 *              permitida, pero el docente no abre su detalle ni lo comenta.
 *  - TEACHERS  Ademas, el docente de su alcance academico puede abrir el
 *              detalle completo y registrar retroalimentacion (RF16).
 */
export enum ProjectVisibility {
  PRIVATE = 'private',
  PROFILE = 'profile',
  TEACHERS = 'teachers',
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
