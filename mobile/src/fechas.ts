/**
 * V3.2 §38: fechas y horas en la zona de la institución (America/La_Paz),
 * sea cual sea la del teléfono, igual que la web.
 */
export const ZONA = 'America/La_Paz';

export function fechaHora(iso?: string | null, opciones: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONA, ...opciones,
  });
}

export function soloFecha(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: ZONA });
}

/** Solo la hora, para el fin de una actividad del mismo día. */
export function soloHora(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', timeZone: ZONA });
}

/** El fin se escribe entero solo si cae otro día que el inicio. */
export function rango(inicio?: string | null, fin?: string | null): string {
  if (!inicio) return '';
  if (!fin) return fechaHora(inicio);
  return soloFecha(inicio) === soloFecha(fin) ? `${fechaHora(inicio)} – ${soloHora(fin)}` : `${fechaHora(inicio)} – ${fechaHora(fin)}`;
}
