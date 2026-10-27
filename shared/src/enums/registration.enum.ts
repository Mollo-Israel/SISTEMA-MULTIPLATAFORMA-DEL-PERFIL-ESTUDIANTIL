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
 *
 * V5 §6: inscripción, admisión y asistencia son tres cosas distintas.
 *
 *   REGISTERED → solicitó inscripción (pendiente de admisión).
 *   ACCEPTED   → admitido: tiene plaza. **No** es haber asistido.
 *   REJECTED   → la solicitud no se admitió (con motivo). No es una ausencia.
 *   CONFIRMED / ABSENT → asistencia, registrada cuando el evento ya empezó.
 */
export enum RegistrationStatus {
  INTERESTED = 'interested',
  REGISTERED = 'registered',
  /**
   * Admisión aceptada: el estudiante tiene plaza.
   *
   * En una interna la decide el responsable (o es automática si la actividad
   * es abierta y sin cupo). En una externa (V3 §15) es que el proveedor lo
   * aceptó; ahí habilita adjuntar la credencial al terminar. En ningún caso
   * alimenta la trayectoria.
   */
  ACCEPTED = 'accepted',
  /** V5 §6: el responsable no admitió la solicitud, con un motivo. */
  REJECTED = 'rejected',
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

/** V5 §6: estados de asistencia (solo los registra el responsable, con el evento empezado). */
export const ATTENDANCE_STATUSES: readonly RegistrationStatus[] = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.ABSENT,
];

/**
 * Cómo se entra a una actividad (§22, `registration_mode`).
 *
 * No cambia quién registra la asistencia —eso siempre es el responsable
 * (§23)—, sino si hace falta que alguien admita la inscripción de antemano.
 * V5 §6.1: una interna abierta y sin cupo admite sola; con cupo, o en modo
 * por aprobación, admite el responsable. Admitir nunca es asistir.
 */
export enum RegistrationMode {
  /** Admisión automática si no hay cupo; con cupo, la decide el responsable. */
  OPEN = 'open',
  /** Toda solicitud la admite o rechaza el responsable. */
  APPROVAL = 'approval',
}

/** V5 ND-06: días después del fin del evento para regularizar la asistencia. */
export const ATTENDANCE_WINDOW_DAYS_DEFAULT = 7;

/** V5 §5.5: tolerancia al comparar «ahora» con el inicio, en minutos. */
export const ACTIVITY_START_TOLERANCE_MINUTES_DEFAULT = 2;
