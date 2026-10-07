/**
 * Participación de un estudiante en una actividad (especificacion §23).
 *
 * La distinción entre los tres primeros estados no es de matiz: es lo que
 * separa una intención de una experiencia.
 *
 *   INTERESTED → intención, **no** experiencia.
 *   REGISTERED → inscripción, **no** experiencia.
 *   CONFIRMED  → experiencia registrada.
 *
 * Por eso solo `CONFIRMED` alimenta la trayectoria y la afinidad (§51.2). Decir
 * «me interesa» no es haber estado.
 */
export enum RegistrationStatus {
  INTERESTED = 'interested',
  REGISTERED = 'registered',
  /**
   * V3 §15: en una oportunidad externa, el responsable registra que el
   * proveedor aceptó al estudiante. Aceptado no es haber obtenido la
   * credencial: no alimenta la trayectoria; habilita adjuntarla al terminar.
   */
  ACCEPTED = 'accepted',
  CONFIRMED = 'confirmed',
  /** Se inscribió y no asistió. Lo marca el responsable. */
  ABSENT = 'absent',
  /** Se dio de baja antes de la actividad. Lo decide el propio estudiante. */
  CANCELLED = 'cancelled',
}

/** Estados que suponen experiencia real y por tanto alimentan el perfil (§23). */
export const EXPERIENCE_STATUSES: readonly RegistrationStatus[] = [
  RegistrationStatus.CONFIRMED,
];

/** Estados que ocupan un lugar del cupo. */
export const OCCUPYING_STATUSES: readonly RegistrationStatus[] = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.ACCEPTED,
];

/**
 * Cómo se entra a una actividad (§22, `registration_mode`).
 *
 * No cambia quién confirma la participación —eso siempre es el responsable
 * (§23)—, sino si hace falta que alguien acepte la inscripción de antemano.
 */
export enum RegistrationMode {
  /** Cualquier estudiante se inscribe mientras haya cupo. */
  OPEN = 'open',
  /** La inscripción queda registrada pero la acepta el responsable. */
  APPROVAL = 'approval',
}
