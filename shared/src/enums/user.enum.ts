/**
 * Estados de una cuenta (especificacion §9.3).
 *
 * Una cuenta nace provisionada y sin contraseña utilizable: hasta que su
 * titular demuestra control del correo institucional queda en
 * PENDING_ACTIVATION. Solo ACTIVE permite iniciar sesion.
 *
 * Una cuenta con historial no se elimina fisicamente (§9.3, §85): se lleva a
 * INACTIVE, que conserva proyectos, evidencias y trayectoria.
 */
export enum UserStatus {
  /** Provisionada por importacion o alta administrativa. Aun no puede entrar. */
  PENDING_ACTIVATION = 'pending_activation',
  /** Activada por su titular. Unico estado que permite iniciar sesion. */
  ACTIVE = 'active',
  /** Acceso retirado temporalmente por decision administrativa. Reversible. */
  SUSPENDED = 'suspended',
  /** Baja definitiva conservando el historial. */
  INACTIVE = 'inactive',
}

/** Estados que permiten operar en el sistema. */
export const OPERABLE_USER_STATUSES: readonly UserStatus[] = [UserStatus.ACTIVE];
