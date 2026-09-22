/**
 * Puerto de recomputacion centralizada (especificacion §109).
 *
 * Un solo punto de entrada para decir «a este estudiante le cambio algo
 * relevante». Quien lo llama no tiene que saber que hay que recalcular ni en
 * que orden: esa decision vive en un sitio, y cuando aparezca la gamificacion
 * (§66) no habra que volver a recorrer diecisiete servicios para engancharla.
 *
 * Sustituye a `AFFINITY_RECALCULATION`, que nombraba solo la mitad de lo que
 * hacia desde que las recomendaciones tambien dependen del calculo.
 */
export const TRAJECTORY_RECALCULATION = 'TRAJECTORY_RECALCULATION';

/**
 * Que señal cambio, para poder explicar el recalculo y, mas adelante, decidir
 * que hace falta recomputar y que no (§57 enumera las que obligan).
 */
export enum TrajectorySignal {
  INTEREST = 'interest',
  SKILL = 'skill',
  ACTIVITY_PARTICIPATION = 'activity_participation',
  PROJECT = 'project',
  PROJECT_BACKING = 'project_backing',
  MEMBERSHIP = 'membership',
  EVIDENCE = 'evidence',
  CERTIFICATE = 'certificate',
  VALIDATION = 'validation',
  FEEDBACK = 'feedback',
  PROFILE = 'profile',
}

export interface TrajectoryRecalculationPort {
  /**
   * Recomputa la trayectoria del estudiante.
   *
   * `studentProfileId` debe ser el del **dueño de la señal** (§57), que no
   * siempre es quien provoco el cambio: una evidencia la adjunta un integrante
   * y es suya, no del creador del proyecto.
   */
  requestRecalculation(studentProfileId: string, signal?: TrajectorySignal): Promise<void>;
}
