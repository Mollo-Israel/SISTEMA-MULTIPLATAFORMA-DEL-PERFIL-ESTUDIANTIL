/**
 * Fechas y horas en la zona de la carrera (V3.2 §38).
 *
 * La API guarda instantes (UTC). Un `<input type="datetime-local">` trabaja con
 * la hora «de pared», sin zona. Antes el formulario cargaba `iso.slice(0, 16)`
 * —la hora UTC— como si fuera local, y cada guardado corría la hora 4 horas
 * (C11: 16:45 → 20:45). Aquí la conversión es explícita y en una zona
 * definida, la misma para todos sin importar la del navegador.
 */
export const ZONA_HORARIA: string = import.meta.env.VITE_APP_TIMEZONE || 'America/La_Paz';

/** Componentes de un instante en la zona de la carrera. */
function partes(instante: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number> {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(instante)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

/** Diferencia (ms) entre la hora de pared de la zona y UTC en ese instante. */
function desfase(instante: Date): number {
  const p = partes(instante);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** ISO de la API → valor de un `datetime-local` («2026-10-12T16:45») en la zona de la carrera. */
export function isoAEntrada(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = partes(d);
  return `${p.year}-${dos(p.month)}-${dos(p.day)}T${dos(p.hour)}:${dos(p.minute)}`;
}

/** Valor de un `datetime-local` (hora de pared en la zona de la carrera) → ISO UTC. */
export function entradaAIso(valor: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor ?? '');
  if (!m) return undefined;
  const pared = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Primer intento con el desfase de ese momento; se corrige una vez por si
  // el desfase cambia justo ahí (horario de verano en otras zonas).
  let utc = pared - desfase(new Date(pared));
  utc = pared - desfase(new Date(utc));
  return new Date(utc).toISOString();
}

/** Fecha y hora legibles en la zona de la carrera. */
export function formatearFechaHora(iso?: string | null, opciones: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-BO', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opciones,
  });
}
