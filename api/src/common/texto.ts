/**
 * Utilidades de texto de costo lineal.
 *
 * Reemplazan expresiones regulares que, ante ciertas entradas, retroceden de
 * forma no lineal (SonarQube S8786). Cada función devuelve exactamente lo
 * mismo que la expresión que reemplaza; test/jest/unit/texto.spec.ts lo
 * comprueba comparando ambas sobre miles de entradas.
 */

/** Quita del final los caracteres del conjunto. Ej.: `recortarFinal('a//', '/')` → `'a'`. */
export function recortarFinal(texto: string, conjunto: string): string {
  let fin = texto.length;
  while (fin > 0 && conjunto.includes(texto[fin - 1])) fin -= 1;
  return texto.slice(0, fin);
}

/** Quita al inicio y al final los caracteres del conjunto. */
export function recortarExtremos(texto: string, conjunto: string): string {
  let inicio = 0;
  let fin = texto.length;
  while (inicio < fin && conjunto.includes(texto[inicio])) inicio += 1;
  while (fin > inicio && conjunto.includes(texto[fin - 1])) fin -= 1;
  return texto.slice(inicio, fin);
}

/**
 * Separa «Nombre <correo@dominio>» en sus dos partes. Equivale a
 * `/^(.*)<([^>]+)>\s*$/.exec(texto)` (grupos 1 y 2), o null si no tiene esa forma.
 */
export function separarNombreYDireccion(texto: string): [string, string] | null {
  let cierre = texto.length - 1;
  while (cierre >= 0 && /\s/.test(texto[cierre])) cierre -= 1;
  if (cierre < 0 || texto[cierre] !== '>') return null;
  // Entre «<» y «>» no puede haber otro «>», y el nombre no cruza saltos de línea.
  const mayorPrevio = cierre > 0 ? texto.lastIndexOf('>', cierre - 1) : -1;
  let tope = cierre - 2;
  for (let k = 0; k <= tope; k += 1) {
    if ('\n\r\u2028\u2029'.includes(texto[k])) {
      tope = k - 1;
      break;
    }
  }
  const apertura = tope >= 0 ? texto.lastIndexOf('<', tope) : -1;
  if (apertura === -1 || apertura <= mayorPrevio) return null;
  return [texto.slice(0, apertura), texto.slice(apertura + 1, cierre)];
}

/**
 * Parte opcional de un mensaje: `antes + valor + despues` si hay valor; si no, vacío.
 * Ej.: `siHay(lugar, 'en ')` → «en Aula 3» o «».
 */
export function siHay(valor: string | number | null | undefined | false, antes: string, despues = ''): string {
  return valor ? `${antes}${valor}${despues}` : '';
}

/** El texto entre comillas latinas: «texto». */
export function entreComillas(texto: string): string {
  return `«${texto}»`;
}

/** Escapa «%», «_» y «\» para que un ILIKE busque el texto tal cual. */
export function escaparComodinesLike(texto: string): string {
  return texto.replace(/[%_\\]/g, (c) => '\\' + c);
}

/** Equivale a `texto.replace(/\/+$/, '')`: una URL base sin barras al final. */
export function quitarBarrasFinales(texto: string): string {
  return recortarFinal(texto, '/');
}

/** Equivale a `/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)`. */
export function tieneFormatoDeCorreo(texto: string): boolean {
  if (/\s/.test(texto)) return false;
  const arroba = texto.indexOf('@');
  if (arroba <= 0 || arroba !== texto.lastIndexOf('@')) return false;
  const dominio = texto.slice(arroba + 1);
  // Hace falta un punto con al menos un carácter antes y otro después.
  const punto = dominio.indexOf('.', 1);
  return punto > 0 && punto < dominio.length - 1;
}

const esLocal = (c: string) => /[A-Za-z0-9._%+-]/.test(c);
const esDominio = (c: string) => /[A-Za-z0-9.-]/.test(c);
const esLetra = (c: string | undefined) => c !== undefined && /[A-Za-z]/.test(c);

/**
 * Equivale a `texto.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, reemplazo)`.
 * Un correo solo puede empezar al comienzo de un tramo de caracteres válidos
 * que termina en «@»; el dominio termina en el último «.xx» posible del tramo.
 */
export function ocultarCorreos(texto: string, reemplazo: string): string {
  let salida = '';
  let i = 0;
  const n = texto.length;
  while (i < n) {
    if (!esLocal(texto[i])) {
      salida += texto[i];
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && esLocal(texto[j])) j += 1;
    const fin = j < n && texto[j] === '@' ? finDeDominio(texto, j + 1) : -1;
    if (fin > 0) {
      salida += reemplazo;
      i = fin;
    } else {
      salida += texto.slice(i, j);
      i = j;
    }
  }
  return salida;
}

/** Fin del dominio que empieza en `desde`, o -1 si no hay un «.xx» válido. */
function finDeDominio(texto: string, desde: number): number {
  let tramo = desde;
  while (tramo < texto.length && esDominio(texto[tramo])) tramo += 1;
  // El punto final más a la derecha que deja al menos un carácter antes y dos letras después.
  for (let k = tramo - 1; k >= desde + 1; k -= 1) {
    if (texto[k] === '.' && esLetra(texto[k + 1]) && esLetra(texto[k + 2]) && k + 2 < tramo) {
      let fin = k + 1;
      while (fin < tramo && esLetra(texto[fin])) fin += 1;
      return fin;
    }
  }
  return -1;
}

const separaCorreo = (c: string) => /[\s@'"]/.test(c);

/** Equivale a `texto.replace(/[^\s@'"]+@[^\s@'"]+/g, reemplazo)`. */
export function ocultarCorreosEnMensaje(texto: string, reemplazo: string): string {
  let salida = '';
  let i = 0;
  const n = texto.length;
  while (i < n) {
    if (separaCorreo(texto[i])) {
      salida += texto[i];
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && !separaCorreo(texto[j])) j += 1;
    if (j + 1 < n && texto[j] === '@' && !separaCorreo(texto[j + 1])) {
      let k = j + 1;
      while (k < n && !separaCorreo(texto[k])) k += 1;
      salida += reemplazo;
      i = k;
    } else {
      salida += texto.slice(i, j);
      i = j;
    }
  }
  return salida;
}

/** Equivale a `html.replace(/<[^>]+>/g, reemplazo)`: cada etiqueta se cambia por el reemplazo. */
export function reemplazarEtiquetas(html: string, reemplazo: string): string {
  let salida = '';
  let i = 0;
  let mayor = html.indexOf('>');
  while (i < html.length) {
    if (html[i] === '<') {
      if (mayor !== -1 && mayor < i) mayor = html.indexOf('>', i);
      if (mayor === -1) return salida + html.slice(i);
      if (mayor > i + 1) {
        salida += reemplazo;
        i = mayor + 1;
        continue;
      }
    }
    salida += html[i];
    i += 1;
  }
  return salida;
}

/** Equivale a `texto.replace(/\/.*$/, '')`: corta desde la primera barra de la última línea. */
export function cortarDesdeBarra(texto: string): string {
  // «.» no cruza saltos de línea: la barra debe estar en la última línea.
  let ultimaLinea = 0;
  for (let k = 0; k < texto.length; k += 1) {
    if ('\n\r\u2028\u2029'.includes(texto[k])) ultimaLinea = k + 1;
  }
  const barra = texto.indexOf('/', ultimaLinea);
  return barra === -1 ? texto : texto.slice(0, barra);
}

// Equivale a reemplazar la expresión /[ \t]*\n[ \t]*/g por '\n': quita los
// espacios y tabuladores pegados a cada salto de línea.
export function limpiarBordesDeLineas(texto: string): string {
  const lineas = texto.split('\n');
  const ultima = lineas.length - 1;
  return lineas
    .map((linea, k) => {
      // Cada línea pierde los espacios pegados a los saltos que la rodean.
      const sinInicio = k > 0 ? quitarInicio(linea, ' \t') : linea;
      return k < ultima ? recortarFinal(sinInicio, ' \t') : sinInicio;
    })
    .join('\n');
}

function quitarInicio(texto: string, conjunto: string): string {
  let inicio = 0;
  while (inicio < texto.length && conjunto.includes(texto[inicio])) inicio += 1;
  return texto.slice(inicio);
}
