import { inflateSync } from 'node:zlib';

/**
 * Extracción de texto nativo de un PDF (§29, paso 1).
 *
 * Se escribe a mano en lugar de traer una librería porque las dos opciones
 * habituales pesan entre 21 y 33 MB —vendoran su propio corpus de PDFs de
 * prueba— y este proyecto se entrega y se clona. Esto son unas 150 líneas que
 * usan `zlib`, que ya viene con Node.
 *
 * Qué cubre: PDFs generados por herramientas ofimáticas y por los emisores de
 * certificados habituales, con flujos sin comprimir o en FlateDecode y fuentes
 * con codificación estándar.
 *
 * Qué no cubre: fuentes con CMap embebido o codificaciones CID exóticas, y
 * cifrado. En esos casos devuelve poco texto o ninguno, y el pipeline lo trata
 * como lo que es —texto insuficiente— y pasa a OCR. §29 diseñó esa escalera
 * precisamente porque ningún extractor lo lee todo.
 */

/** Por debajo de esto se considera que el PDF no tiene texto aprovechable. */
export const MIN_USEFUL_TEXT = 40;

/** Tope de salida: un certificado no necesita más y acota el consumo. */
const MAX_TEXT = 20_000;

export interface PdfTextResult {
  text: string;
  /** Flujos que se pudieron decodificar. Cero suele significar PDF cifrado. */
  streams: number;
  /** URLs de anotaciones de enlace, que a menudo son la de verificación. */
  links: string[];
}

export function extractPdfText(buffer: Buffer): PdfTextResult {
  if (!esPdf(buffer)) return { text: '', streams: 0, links: [] };

  const trozos: string[] = [];
  let streams = 0;

  for (const stream of recorrerStreams(buffer)) {
    const contenido = decodificar(stream.datos, stream.filtros);
    if (!contenido) continue;
    streams += 1;
    const texto = textoDeContenido(contenido);
    if (texto) trozos.push(texto);
    if (trozos.join(' ').length > MAX_TEXT) break;
  }

  return {
    text: normalizar(trozos.join('\n')).slice(0, MAX_TEXT),
    streams,
    links: extraerEnlaces(buffer),
  };
}

export function esPdf(buffer: Buffer): boolean {
  return buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * Recorre los objetos `stream ... endstream` con su diccionario.
 *
 * No se construye la tabla de referencias cruzadas: para extraer texto basta
 * con recorrer el archivo de principio a fin, y así un PDF con la tabla rota
 * —que los hay— sigue dando texto.
 */
function* recorrerStreams(buffer: Buffer): Generator<{ datos: Buffer; filtros: string[] }> {
  const marca = Buffer.from('stream', 'latin1');
  let desde = 0;

  while (desde < buffer.length) {
    const inicio = buffer.indexOf(marca, desde);
    if (inicio === -1) return;

    // El diccionario del objeto precede a la palabra `stream`. Se mira hacia
    // atrás un trozo acotado para leer sus filtros.
    const dicDesde = Math.max(0, inicio - 600);
    const diccionario = buffer.subarray(dicDesde, inicio).toString('latin1');

    let datosDesde = inicio + marca.length;
    // Tras `stream` va CRLF o LF, nunca otra cosa.
    if (buffer[datosDesde] === 0x0d) datosDesde += 1;
    if (buffer[datosDesde] === 0x0a) datosDesde += 1;

    const fin = buffer.indexOf(Buffer.from('endstream', 'latin1'), datosDesde);
    if (fin === -1) return;

    yield { datos: buffer.subarray(datosDesde, fin), filtros: leerFiltros(diccionario) };
    desde = fin + 9;
  }
}

function leerFiltros(diccionario: string): string[] {
  const m = /\/Filter\s*(\/[A-Za-z0-9]+|\[[^\]]*\])/.exec(diccionario);
  if (!m) return [];
  return [...m[1].matchAll(/\/([A-Za-z0-9]+)/g)].map((x) => x[1]);
}

function decodificar(datos: Buffer, filtros: string[]): string | null {
  // Un flujo de imagen o de fuente no tiene texto que extraer y descomprimirlo
  // solo gasta tiempo.
  if (filtros.some((f) => f === 'DCTDecode' || f === 'JPXDecode' || f === 'CCITTFaxDecode')) {
    return null;
  }
  try {
    if (filtros.includes('FlateDecode')) {
      return inflateSync(datos).toString('latin1');
    }
    if (filtros.length === 0) {
      return datos.toString('latin1');
    }
  } catch {
    // Flujo corrupto o con un filtro que no se implementa: se ignora y se
    // sigue con el resto. Un objeto ilegible no debe invalidar el documento.
  }
  return null;
}

/**
 * Extrae los literales de los operadores que muestran texto.
 *
 * `Tj` y `'`/`"` reciben una cadena; `TJ` recibe un arreglo donde se alternan
 * cadenas y ajustes de posición. Los ajustes grandes y negativos separan
 * palabras, así que se traducen a un espacio: sin eso el texto sale pegado.
 */
function textoDeContenido(contenido: string): string {
  const salida: string[] = [];

  for (const m of contenido.matchAll(/\[((?:[^\][\\]|\\.)*)\]\s*TJ|\((?:[^()\\]|\\.)*\)\s*(?:Tj|')/g)) {
    if (m[1] !== undefined) {
      let linea = '';
      for (const parte of m[1].matchAll(/\((?:[^()\\]|\\.)*\)|-?\d+(?:\.\d+)?/g)) {
        const t = parte[0];
        if (t.startsWith('(')) {
          linea += literal(t);
        } else if (Number(t) < -120) {
          linea += ' ';
        }
      }
      if (linea.trim()) salida.push(linea);
    } else {
      const lit = /\((?:[^()\\]|\\.)*\)/.exec(m[0]);
      if (lit) {
        const t = literal(lit[0]);
        if (t.trim()) salida.push(t);
      }
    }
  }

  // Cadenas hexadecimales: <0041...> Tj
  for (const m of contenido.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    const t = desdeHex(m[1]);
    if (t.trim()) salida.push(t);
  }

  return salida.join('\n');
}

/** Convierte un literal `(...)` de PDF a texto, resolviendo sus escapes. */
function literal(crudo: string): string {
  const cuerpo = crudo.slice(1, -1);
  let salida = '';
  for (let i = 0; i < cuerpo.length; i += 1) {
    const c = cuerpo[i];
    if (c !== '\\') {
      salida += c;
      continue;
    }
    const siguiente = cuerpo[i + 1];
    i += 1;
    switch (siguiente) {
      case 'n': salida += '\n'; break;
      case 'r': salida += '\r'; break;
      case 't': salida += '\t'; break;
      case 'b': case 'f': salida += ' '; break;
      case '(': case ')': case '\\': salida += siguiente; break;
      case '\n': break; // continuación de línea: no produce carácter
      default:
        if (siguiente >= '0' && siguiente <= '7') {
          // Escape octal, de una a tres cifras.
          let oct = siguiente;
          while (oct.length < 3 && cuerpo[i + 1] >= '0' && cuerpo[i + 1] <= '7') {
            oct += cuerpo[i + 1];
            i += 1;
          }
          salida += String.fromCharCode(parseInt(oct, 8));
        } else {
          salida += siguiente ?? '';
        }
    }
  }
  return salida;
}

function desdeHex(crudo: string): string {
  const limpio = crudo.replace(/\s+/g, '');
  let salida = '';
  // Se leen de dos en dos; con cuatro cifras seria UTF-16, que aqui se ignora
  // porque produciria basura mas que texto.
  for (let i = 0; i + 1 < limpio.length; i += 2) {
    const code = parseInt(limpio.slice(i, i + 2), 16);
    if (code >= 32 || code === 10 || code === 13) salida += String.fromCharCode(code);
  }
  return salida;
}

/** URLs de las anotaciones de enlace: suelen ser la de verificación (§29). */
function extraerEnlaces(buffer: Buffer): string[] {
  const crudo = buffer.toString('latin1');
  const encontrados = new Set<string>();
  for (const m of crudo.matchAll(/\/URI\s*\(((?:[^()\\]|\\.)*)\)/g)) {
    const url = literal(`(${m[1]})`).trim();
    if (/^https?:\/\//i.test(url)) encontrados.add(url.slice(0, 500));
  }
  return [...encontrados].slice(0, 10);
}

/**
 * Normaliza el texto para que sea comparable (§29, paso 4).
 *
 * Los PDF reparten una palabra en varios literales, así que llegan espacios
 * repetidos y saltos donde no corresponden.
 */
export function normalizar(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
