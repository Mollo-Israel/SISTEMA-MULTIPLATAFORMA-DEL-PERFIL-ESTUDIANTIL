import {
  ActivityOrigin,
  ActivityOutcomePolicy,
  ActivityStatus,
  RegistrationStatus,
} from '@perfil/shared';

/**
 * Reglas puras de elegibilidad de credenciales (V3 §15, §14.2).
 *
 * Viven aparte del servicio para poder probarlas sin base de datos.
 */
interface OportunidadMin {
  originType: ActivityOrigin;
  outcomePolicy: ActivityOutcomePolicy;
  status: ActivityStatus;
  endAt: Date | string | null;
  eventDate: Date | string | null;
}

/** ¿Esta oportunidad espera una credencial de un tercero? */
export function esperaCredencial(a: Pick<OportunidadMin, 'originType' | 'outcomePolicy'>): boolean {
  return a.originType === ActivityOrigin.EXTERNAL
    || a.outcomePolicy === ActivityOutcomePolicy.EXTERNAL_CREDENTIAL_EXPECTED;
}

/** Estado de inscripción que habilita la credencial: aceptado en externa, confirmado en interna. */
export function estadoQueHabilita(a: Pick<OportunidadMin, 'originType'>): RegistrationStatus {
  return a.originType === ActivityOrigin.EXTERNAL
    ? RegistrationStatus.ACCEPTED
    : RegistrationStatus.CONFIRMED;
}

/** ¿Ya terminó? (§15 «fecha finalizada»): fin pasado, o dada por finalizada. Cancelada, nunca. */
export function terminada(a: Pick<OportunidadMin, 'status' | 'endAt' | 'eventDate'>, ahora = new Date()): boolean {
  if (a.status === ActivityStatus.CANCELLED) return false;
  if (a.status === ActivityStatus.FINISHED) return true;
  const fin = a.endAt ?? a.eventDate;
  return !!fin && new Date(fin).getTime() <= ahora.getTime();
}

/** INTERESTED → REGISTERED → ACCEPTED → fecha finalizada → EVIDENCE_ELIGIBLE. */
export function elegible(a: OportunidadMin, status: RegistrationStatus, ahora = new Date()): boolean {
  return esperaCredencial(a) && status === estadoQueHabilita(a) && terminada(a, ahora);
}
