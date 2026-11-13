/**
 * Lectores de manifiestos sin expresiones regulares de costo no lineal
 * (SonarQube S8786). El texto viene de un repositorio ajeno: una entrada
 * preparada a propósito no debe poder trabar el servidor. Cada función
 * equivale exactamente a la expresión que reemplaza;
 * test/jest/unit/manifiestos.spec.ts lo comprueba con miles de entradas.
 */

const esEspacio = (c: string | undefined): boolean => c !== undefined && /\s/.test(c);
const esSaltoDeLinea = (c: string): boolean => c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029';

function finDeEspacios(texto: string, desde: number): number {
  let i = desde;
  while (i < texto.length && esEspacio(texto[i])) i += 1;
  return i;
}

/** ¿Hay en `t` un cierre de bloque? Un salto seguido de algo sin sangría, o de dos espacios y algo. */
function esCierre(texto: string, t: number): boolean {
  if (texto[t] !== '\n') return false;
  const siguiente = texto[t + 1];
  if (siguiente !== undefined && !esEspacio(siguiente)) return true;
  return siguiente === ' ' && texto[t + 2] === ' ' && texto[t + 3] !== undefined && !esEspacio(texto[t + 3]);
}

/**
 * Bloque del importador raíz («.:») de un pnpm-lock.yaml. Equivale a
 * `/importers:\s*\n\s+\.:\s*\n([\s\S]*?)(?:\n\S|\n {2}\S)/.exec(texto)?.[1] ?? ''`.
 */
export function bloqueImportadorRaiz(texto: string): string {
  // Si una búsqueda de cierre falló desde una posición, falla desde cualquier posición posterior.
  let sinCierreDesde = Number.POSITIVE_INFINITY;
  const buscarCierre = (desde: number): number => {
    if (desde >= sinCierreDesde) return -1;
    for (let t = texto.indexOf('\n', desde); t !== -1; t = texto.indexOf('\n', t + 1)) {
      if (esCierre(texto, t)) return t;
    }
    sinCierreDesde = desde;
    return -1;
  };
  for (let p = texto.indexOf('importers:'); p !== -1; p = texto.indexOf('importers:', p + 1)) {
    const bloque = bloqueDesde(texto, p + 'importers:'.length, buscarCierre);
    if (bloque !== null) return bloque;
  }
  return '';
}

function bloqueDesde(texto: string, inicio: number, buscarCierre: (desde: number) => number): string | null {
  // «\s*\n\s+» hasta «.:»: hace falta un salto que no sea el último espacio antes del punto.
  const punto = finDeEspacios(texto, inicio);
  if (texto[punto] !== '.' || texto[punto + 1] !== ':') return null;
  if (punto - 2 < inicio || texto.lastIndexOf('\n', punto - 2) < inicio) return null;
  // «\s*\n» después de «.:»: el bloque empieza tras el último salto de ese tramo de espacios.
  const tras = punto + 2;
  const finTramo = finDeEspacios(texto, tras);
  const ultimo = finTramo > tras ? texto.lastIndexOf('\n', finTramo - 1) : -1;
  if (ultimo < tras) return null;
  const cierre = buscarCierre(ultimo + 1);
  if (cierre !== -1) return texto.slice(ultimo + 1, cierre);
  // Sin cierre más adelante, el bloque puede cerrarse en ese mismo salto si
  // hay otro salto antes dentro del tramo (el bloque queda en blanco).
  if (esCierre(texto, ultimo)) {
    const anterior = texto.lastIndexOf('\n', ultimo - 1);
    if (anterior >= tras) return texto.slice(anterior + 1, ultimo);
  }
  return null;
}

const esCaracterDeNombre = (c: string | undefined): boolean => c !== undefined && /[A-Za-z0-9_.-]/.test(c);
const esComilla = (c: string | undefined): boolean => c === '"' || c === "'";
const ABRE_VERSION = '<>=!~^ ;[';

/**
 * Nombres de paquete entre comillas de un pyproject.toml. Equivale a
 * `[...texto.matchAll(/["']([A-Za-z0-9_.-]+)\s*(?:[<>=!~^ ;\[].*?)?["']/g)].map((m) => m[1])`.
 */
export function nombresEntreComillas(texto: string): string[] {
  const nombres: string[] = [];
  let p = 0;
  while (p < texto.length) {
    const finNombre = esComilla(texto[p]) ? finDeNombre(texto, p + 1) : p + 1;
    if (finNombre === p + 1) {
      p += 1;
      continue;
    }
    // La comilla de cierre es la primera después del nombre.
    let cierre = finNombre;
    while (cierre < texto.length && !esComilla(texto[cierre])) cierre += 1;
    if (cierre < texto.length && restoValido(texto, finNombre, cierre)) {
      nombres.push(texto.slice(p + 1, finNombre));
      p = cierre + 1;
    } else {
      p += 1;
    }
  }
  return nombres;
}

function finDeNombre(texto: string, desde: number): number {
  let i = desde;
  while (esCaracterDeNombre(texto[i])) i += 1;
  return i;
}

/** Entre el nombre y la comilla: solo espacios, o espacios y una versión de una sola línea. */
function restoValido(texto: string, desde: number, hasta: number): boolean {
  const i = Math.min(finDeEspacios(texto, desde), hasta);
  if (i === hasta) return true;
  for (let k = i; k < hasta; k += 1) if (esSaltoDeLinea(texto[k])) return false;
  if (ABRE_VERSION.includes(texto[i])) return true;
  // Si no empieza con un operador, la versión la abre un espacio previo de la misma línea.
  for (let k = i - 1; k >= desde; k -= 1) {
    if (esSaltoDeLinea(texto[k])) return false;
    if (texto[k] === ' ') return true;
  }
  return false;
}
