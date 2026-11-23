import { randomBytes } from 'node:crypto';

/**
 * Código público de verificación: `AF-XXXX-XXXX-XXXXC`.
 *
 * - 12 símbolos Crockford Base32: 60 bits aleatorios. Con el límite de
 *   peticiones del verificador, adivinar uno lleva millones de años.
 * - Sin I, L, O ni U: no se confunden al dictarlos o copiarlos de un papel.
 * - Un símbolo de control Luhn mod 32 detecta cualquier error en un solo
 *   carácter y casi todas las transposiciones de dos vecinos, antes de
 *   consultar la base. Usa el mismo alfabeto: la URL queda limpia.
 */
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const N = ALFABETO.length;
const PREFIJO = 'AF';

function luhnSuma(simbolos: string, factorInicial: number): number {
  let factor = factorInicial;
  let suma = 0;
  for (let i = simbolos.length - 1; i >= 0; i -= 1) {
    const sumando = factor * ALFABETO.indexOf(simbolos[i]);
    factor = factor === 2 ? 1 : 2;
    suma += Math.floor(sumando / N) + (sumando % N);
  }
  return suma;
}

export function checkSymbol(cuerpo: string): string {
  const resto = luhnSuma(cuerpo, 2) % N;
  return ALFABETO[(N - resto) % N];
}

const formatear = (cuerpo: string, control: string) =>
  `${PREFIJO}-${cuerpo.slice(0, 4)}-${cuerpo.slice(4, 8)}-${cuerpo.slice(8)}${control}`;

export function generatePublicCode(): string {
  const bytes = randomBytes(12);
  let cuerpo = '';
  // 5 bits de cada byte aleatorio: 32 valores exactos, sin sesgo.
  for (const b of bytes) cuerpo += ALFABETO[b & 31];
  return formatear(cuerpo, checkSymbol(cuerpo));
}

/**
 * Normaliza lo que escribió una persona y comprueba el control. Devuelve el
 * código canónico o `null` si no puede ser un código válido.
 */
export function normalizePublicCode(entrada: unknown): string | null {
  if (typeof entrada !== 'string' || entrada.length > 40) return null;
  let t = entrada.toUpperCase().replace(/[\s-]/g, '');
  if (t.startsWith(PREFIJO) && t.length === 15) t = t.slice(2);
  if (t.length !== 13) return null;
  // Crockford: O se lee como 0; I y L como 1.
  t = t.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (![...t].every((c) => ALFABETO.includes(c))) return null;
  if (luhnSuma(t, 1) % N !== 0) return null;
  return formatear(t.slice(0, 12), t[12]);
}

/** Patrón del código canónico, para validar rutas sin consultar la base. */
export const PUBLIC_CODE_PATTERN = /^AF-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{5}$/;
