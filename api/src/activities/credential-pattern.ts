/**
 * Patrón del código de credencial de una oportunidad externa (V3 §17).
 *
 * `#` dígito · `@` letra · `*` varios caracteres alfanuméricos; el resto se
 * toma literal. Nunca se compila una expresión regular escrita por un
 * usuario: eso abriría la puerta a un ReDoS.
 */

/** Convierte el patrón de §17 en una expresión anclada y sin retroceso peligroso. */
export function credentialPatternToRegExp(pattern: string): RegExp {
  let out = '';
  for (const ch of pattern) {
    if (ch === '#') out += '[0-9]';
    else if (ch === '@') out += '[A-Za-z]';
    else if (ch === '*') out += '[A-Za-z0-9]{0,40}';
    else out += ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  }
  return new RegExp(`^${out}$`, 'i');
}

/** Caracteres admitidos en el patrón: los del código más los tres comodines. */
export const CREDENTIAL_PATTERN_CHARS = /^[A-Za-z0-9#@*._/ -]+$/;
