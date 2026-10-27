/**
 * V5-04 / V5-05 (A01–A03): primer apellido obligatorio y segundo opcional.
 *
 * `last_name` se conserva como el apellido completo que ya muestran la API,
 * la web, el móvil y los informes. Los dos apellidos se guardan aparte. Un
 * apellido heredado con espacios («Pérez García», «De la Cruz») NO se parte
 * por suposición: queda pendiente de que Administración lo separe (A02).
 */

export interface Apellidos {
  firstSurname: string | null;
  secondSurname: string | null;
  lastName: string;
}

/** Apellido completo a partir de los dos apellidos. */
export function componerApellidos(primero: string, segundo?: string | null): string {
  return [primero.trim(), (segundo ?? '').trim()].filter(Boolean).join(' ');
}

/**
 * Un apellido heredado de una sola palabra se separa sin ambigüedad; con
 * espacios queda pendiente (primero y segundo en null).
 */
export function separarLegado(apellido: string): Apellidos {
  const limpio = apellido.trim().replace(/\s+/g, ' ');
  if (limpio && !limpio.includes(' ')) return { firstSurname: limpio, secondSurname: null, lastName: limpio };
  return { firstSurname: null, secondSurname: null, lastName: limpio };
}

/**
 * Lo que se guarda según lo que llegó: los dos apellidos mandan; si solo
 * llegó el apellido completo (clientes y plantillas anteriores), se separa
 * solo cuando no es ambiguo.
 */
export function resolverApellidos(dato: { firstSurname?: string | null; secondSurname?: string | null; lastName?: string | null }): Apellidos | null {
  if (dato.firstSurname?.trim()) {
    const primero = dato.firstSurname.trim();
    const segundo = dato.secondSurname?.trim() || null;
    return { firstSurname: primero, secondSurname: segundo, lastName: componerApellidos(primero, segundo) };
  }
  if (dato.lastName?.trim()) return separarLegado(dato.lastName);
  return null;
}
