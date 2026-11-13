/**
 * Utilidades de texto de costo lineal (SonarQube S8786), iguales a las de la
 * API (api/src/common/texto.ts), donde una prueba compara cada una con la
 * expresión regular que reemplaza.
 */

/** Quita al inicio y al final los caracteres del conjunto. */
export function recortarExtremos(texto: string, conjunto: string): string {
  let inicio = 0;
  let fin = texto.length;
  while (inicio < fin && conjunto.includes(texto[inicio])) inicio += 1;
  while (fin > inicio && conjunto.includes(texto[fin - 1])) fin -= 1;
  return texto.slice(inicio, fin);
}

/** Equivale a `/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)`. */
export function tieneFormatoDeCorreo(texto: string): boolean {
  if (/\s/.test(texto)) return false;
  const arroba = texto.indexOf('@');
  if (arroba <= 0 || arroba !== texto.lastIndexOf('@')) return false;
  const dominio = texto.slice(arroba + 1);
  const punto = dominio.indexOf('.', 1);
  return punto > 0 && punto < dominio.length - 1;
}
