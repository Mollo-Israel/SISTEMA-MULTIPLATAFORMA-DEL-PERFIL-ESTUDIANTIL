import {
  ActivityOrigin,
  BackingTier,
  ManualReviewStatus,
  ProjectBackingTier,
  ProjectStatus,
  RegistrationStatus,
  TrajectoryLevel,
} from '@perfil/shared';

/**
 * Qué puede entrar al currículo verificado y en qué nivel está cada cosa de
 * la trayectoria (V3 §42, §43.3, §44, §45, §64).
 *
 * Reglas puras: la pantalla, la vista previa y el PDF usan las mismas, y las
 * pruebas unitarias las fijan sin base de datos.
 */

/** §43.3 / §64: proyecto ACTIVE y CORROBORATED o REVIEWED. */
export function projectCvEligible(status: ProjectStatus, tier: ProjectBackingTier | null): boolean {
  return status === ProjectStatus.ACTIVE
    && (tier === ProjectBackingTier.CORROBORATED || tier === ProjectBackingTier.REVIEWED);
}

/** §43.3 / §44: actividad interna con participación CONFIRMED. */
export function activityCvEligible(status: RegistrationStatus, origin: ActivityOrigin | null | undefined): boolean {
  return status === RegistrationStatus.CONFIRMED && (origin ?? ActivityOrigin.INTERNAL) === ActivityOrigin.INTERNAL;
}

/**
 * §43.3 / §45: credencial externa CORROBORATED. La oportunidad en sí, o una
 * credencial SUPPORTED, sigue en la trayectoria, pero no afirma finalización.
 */
export function certificateCvEligible(tier: BackingTier | null | undefined): boolean {
  return tier === BackingTier.CORROBORATED;
}

/** §42: nivel de un proyecto, en lenguaje natural. */
export function projectLevel(status: ProjectStatus, tier: ProjectBackingTier | null): TrajectoryLevel {
  if (status === ProjectStatus.DRAFT) return TrajectoryLevel.INCOMPLETE;
  switch (tier) {
    case ProjectBackingTier.REVIEWED: return TrajectoryLevel.REVIEWED;
    case ProjectBackingTier.CORROBORATED: return TrajectoryLevel.CORROBORATED;
    case ProjectBackingTier.SUPPORTED: return TrajectoryLevel.SUPPORTED;
    default: return TrajectoryLevel.DECLARED;
  }
}

/** §42: nivel de una credencial externa. La revisión manual de Dirección es «Revisado». */
export function certificateLevel(
  tier: BackingTier | null | undefined,
  manual: ManualReviewStatus | null | undefined,
): TrajectoryLevel {
  if (manual === ManualReviewStatus.CORROBORATED) return TrajectoryLevel.REVIEWED;
  switch (tier) {
    case BackingTier.CORROBORATED: return TrajectoryLevel.CORROBORATED;
    case BackingTier.SUPPORTED: return TrajectoryLevel.SUPPORTED;
    // Señalada por una contradicción: le falta aclararse para contar.
    case BackingTier.FLAGGED: return TrajectoryLevel.INCOMPLETE;
    default: return TrajectoryLevel.DECLARED;
  }
}

/**
 * §42: nivel de una inscripción. Confirmada la confirma el responsable de la
 * actividad; inscrito, aceptado o interesado todavía no es haberla hecho.
 * Ausente o dada de baja no forma parte de la trayectoria.
 */
export function registrationLevel(status: RegistrationStatus): TrajectoryLevel | null {
  switch (status) {
    case RegistrationStatus.CONFIRMED: return TrajectoryLevel.CORROBORATED;
    case RegistrationStatus.REGISTERED:
    case RegistrationStatus.ACCEPTED:
    case RegistrationStatus.INTERESTED: return TrajectoryLevel.INCOMPLETE;
    default: return null;
  }
}
