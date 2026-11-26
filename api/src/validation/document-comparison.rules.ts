import { MIN_USEFUL_TEXT } from './pdf-text';

/**
 * V7.1 §5.3 · Fase 1: comparación documental con el certificado modelo.
 *
 * Compara los textos **estables** del modelo (curso, proveedor, estructura)
 * con el texto del archivo del estudiante. Lo variable no se compara: el
 * titular del modelo es otra persona, y las fechas y los códigos cambian de
 * un certificado a otro. El resultado dice qué coincide, qué varía y qué
 * falta. No es un porcentaje de autenticidad ni decide nada: es ayuda para la
 * revisión de Dirección.
 *
 * Funciones puras: sin archivos ni red.
 */

/** Frases con las que un certificado presenta a su titular (español e inglés). */
const FRASES_DE_TITULAR = [
  'otorgado a', 'otorgada a', 'se otorga a', 'conferido a', 'conferida a', 'concedido a', 'expedido a',
  'certifica que', 'hace constar que', 'a nombre de', 'nombre del participante', 'participante',
  'awarded to', 'presented to', 'issued to', 'this certifies that', 'this is to certify that', 'granted to',
];

const MAX_LINEAS = 30;
const MAX_POR_LISTA = 20;
const MAX_LARGO = 140;
/** Proporción de palabras compartidas para hablar de «variación» y no de «falta». */
const UMBRAL_VARIACION = 0.6;

export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const recortar = (s: string) => (s.length > MAX_LARGO ? `${s.slice(0, MAX_LARGO - 1)}…` : s);

/** Palabras con contenido: tres letras o más. */
function palabras(normalizada: string): string[] {
  return normalizada.split(' ').filter((t) => t.length >= 3);
}

/** Una fecha, un código o un número largo: cambia de un certificado a otro. */
function esVariable(original: string, normalizada: string): boolean {
  if (/\b(19|20)\d{2}\b/.test(normalizada)) return true;
  if (/\d{4,}/.test(normalizada)) return true;
  // Códigos tipo «NA-2026-AB7» o «UC-1a2b3c»: letras y dígitos mezclados.
  if (original.split(/\s+/).some((t) => t.length >= 5 && /\d/.test(t) && /[a-z]/i.test(t))) return true;
  const letras = normalizada.replace(/[^a-z]/g, '').length;
  return letras < normalizada.replace(/\s/g, '').length * 0.6;
}

function esLineaDeTitular(normalizada: string, titularModelo: string | null): boolean {
  if (FRASES_DE_TITULAR.some((f) => normalizada.startsWith(f) || normalizada.includes(` ${f} `))) return true;
  if (!titularModelo) return false;
  const deTitular = palabras(normalizarTexto(titularModelo));
  return deTitular.length >= 2 && deTitular.every((t) => normalizada.split(' ').includes(t));
}

/** Líneas estables del modelo: las que todo certificado de ese curso repite. */
export function lineasEstables(textoModelo: string, titularModelo: string | null = null): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const cruda of textoModelo.split(/\r?\n/)) {
    const original = cruda.replace(/\s+/g, ' ').trim();
    const n = normalizarTexto(original);
    if (n.length < 8 || palabras(n).length < 2) continue;
    if (esVariable(original, n) || esLineaDeTitular(n, titularModelo)) continue;
    if (vistas.has(n)) continue;
    vistas.add(n);
    out.push(original);
    if (out.length >= MAX_LINEAS) break;
  }
  return out;
}

export interface ComparacionDocumental {
  modelReadable: boolean;
  fileReadable: boolean;
  matched: string[];
  variations: { expected: string; found: string }[];
  missing: string[];
  limitations: string[];
}

/**
 * Compara el modelo con el archivo. `titularModelo` es el nombre que la
 * extracción encontró en el modelo, si encontró alguno: sus líneas no se
 * comparan (no es una discrepancia que el estudiante tenga otro nombre).
 */
export function compararConModelo(
  textoModelo: string,
  textoArchivo: string,
  opciones: { titularModelo?: string | null; modeloPorOcr?: boolean; archivoPorOcr?: boolean } = {},
): ComparacionDocumental {
  const modelReadable = textoModelo.replace(/\s/g, '').length >= MIN_USEFUL_TEXT;
  const fileReadable = textoArchivo.replace(/\s/g, '').length >= MIN_USEFUL_TEXT;
  const limitations: string[] = [];
  const vacio = { modelReadable, fileReadable, matched: [], variations: [], missing: [], limitations };

  if (!modelReadable) {
    limitations.push('No se pudo leer texto del certificado modelo: la comparación no se hizo.');
    return vacio;
  }
  if (!fileReadable) {
    limitations.push('No se pudo leer texto del archivo enviado (¿una imagen sin texto legible?): la comparación no se hizo.');
    return vacio;
  }

  const estables = lineasEstables(textoModelo, opciones.titularModelo ?? null);
  if (!estables.length) {
    limitations.push('El certificado modelo no tiene textos estables que comparar.');
    return vacio;
  }

  const textoN = ` ${normalizarTexto(textoArchivo)} `;
  const lineasArchivo = textoArchivo
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => normalizarTexto(l).length >= 4);

  const matched: string[] = [];
  const variations: { expected: string; found: string }[] = [];
  const missing: string[] = [];
  for (const linea of estables) {
    const n = normalizarTexto(linea);
    if (textoN.includes(` ${n} `)) {
      matched.push(recortar(linea));
      continue;
    }
    const esperadas = palabras(n);
    let mejor: { linea: string; parecido: number } | null = null;
    for (const candidata of lineasArchivo) {
      const suyas = new Set(palabras(normalizarTexto(candidata)));
      const comunes = esperadas.filter((t) => suyas.has(t)).length;
      const parecido = esperadas.length ? comunes / esperadas.length : 0;
      if (!mejor || parecido > mejor.parecido) mejor = { linea: candidata, parecido };
    }
    if (mejor && mejor.parecido >= UMBRAL_VARIACION) variations.push({ expected: recortar(linea), found: recortar(mejor.linea) });
    else missing.push(recortar(linea));
  }

  if (opciones.modeloPorOcr) limitations.push('El modelo se leyó con OCR: puede haber errores de lectura.');
  if (opciones.archivoPorOcr) limitations.push('El archivo se leyó con OCR: puede haber errores de lectura.');
  return {
    modelReadable,
    fileReadable,
    matched: matched.slice(0, MAX_POR_LISTA),
    variations: variations.slice(0, MAX_POR_LISTA),
    missing: missing.slice(0, MAX_POR_LISTA),
    limitations,
  };
}
