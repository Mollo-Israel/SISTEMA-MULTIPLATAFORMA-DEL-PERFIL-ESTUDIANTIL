/**
 * V5 §6: reglas puras de inscripción, admisión y asistencia.
 *
 * Tres cosas distintas: solicitar un lugar, tener el lugar (admisión) y haber
 * asistido. Aquí viven las decisiones que no dependen de la base de datos,
 * para que se puedan probar con el reloj fijado.
 */
import { ActivityOrigin, RegistrationMode, RegistrationStatus } from '@perfil/shared';

interface ActividadMin {
  originType: ActivityOrigin | null;
  registrationMode: RegistrationMode | null;
  capacity: number | null;
  eventDate: Date | null;
  endAt: Date | null;
  attendanceStatus?: string | null;
}

const MINUTO = 60_000;
const DIA = 86_400_000;

/**
 * §6.1: una interna abierta y sin cupo admite sola. Con cupo o por aprobación
 * decide el responsable (la plaza se reserva de forma atómica). En una externa
 * la «aceptación» es del proveedor: nunca es automática.
 */
export function admisionAutomatica(a: ActividadMin): boolean {
  return (a.originType ?? ActivityOrigin.INTERNAL) === ActivityOrigin.INTERNAL
    && (a.registrationMode ?? RegistrationMode.OPEN) === RegistrationMode.OPEN
    && !a.capacity;
}

/**
 * §5.5: ¿ya empezó? Se compara al minuto, con una tolerancia acotada, porque
 * la interfaz elige horas al minuto y el servidor mide milisegundos.
 */
export function yaEmpezo(inicio: Date | null, ahora: Date, toleranciaMin: number): boolean {
  if (!inicio) return false;
  const minutoInicio = Math.floor(inicio.getTime() / MINUTO);
  const minutoAhora = Math.floor(ahora.getTime() / MINUTO);
  return minutoInicio <= minutoAhora + Math.max(0, toleranciaMin);
}

/**
 * V5 §5.5 (B04/B05): ¿el inicio ya pasó, para publicar? Al minuto y con la
 * misma tolerancia acotada: «ahora» (el minuto en curso) se puede publicar;
 * una hora de la mañana a medianoche, no.
 */
export function inicioYaPaso(inicio: Date | null, ahora: Date, toleranciaMin: number): boolean {
  if (!inicio) return false;
  const minutoInicio = Math.floor(inicio.getTime() / MINUTO);
  const minutoAhora = Math.floor(ahora.getTime() / MINUTO);
  return minutoInicio < minutoAhora - Math.max(0, toleranciaMin);
}

/** Código y mensaje del motivo por el que no se puede registrar asistencia, o null. */
export type BloqueoAsistencia = { code: string; message: string } | null;

/**
 * §6.1 / §5.7 / ND-06: la asistencia se registra cuando el evento ya empezó y
 * hasta `ventanaDias` después de su fin, mientras el acta siga abierta.
 * Pasado eso, la corrige Dirección con un motivo (`participation-correction`).
 */
export function bloqueoAsistencia(
  a: ActividadMin,
  ahora: Date,
  toleranciaMin: number,
  ventanaDias: number,
): BloqueoAsistencia {
  if (a.attendanceStatus === 'locked') {
    return { code: 'ATTENDANCE_LOCKED', message: 'La asistencia ya está cerrada. Si hay un error, la corrige Dirección con un motivo.' };
  }
  if (!yaEmpezo(a.eventDate, ahora, toleranciaMin)) {
    return {
      code: 'ATTENDANCE_BEFORE_START',
      message: 'La asistencia se registra cuando la actividad ya empezó. Antes puedes admitir o rechazar solicitudes.',
    };
  }
  const fin = a.endAt ?? a.eventDate;
  if (fin && ahora.getTime() > fin.getTime() + Math.max(0, ventanaDias) * DIA) {
    return {
      code: 'ATTENDANCE_WINDOW_CLOSED',
      message: `Pasaron más de ${ventanaDias} días desde el fin de la actividad: la asistencia la corrige Dirección con un motivo.`,
    };
  }
  return null;
}

/**
 * ¿Desde este estado se puede registrar asistencia? Se necesita la admisión.
 * En una interna con admisión automática, una solicitud anterior a V5
 * (`registered`) cuenta como admitida: nadie tenía que admitirla.
 */
export function admitidoParaAsistencia(a: ActividadMin, actual: RegistrationStatus): boolean {
  if (actual === RegistrationStatus.ACCEPTED || actual === RegistrationStatus.CONFIRMED || actual === RegistrationStatus.ABSENT) {
    return true;
  }
  return actual === RegistrationStatus.REGISTERED && admisionAutomatica(a);
}
