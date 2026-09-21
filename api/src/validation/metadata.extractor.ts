import { IdentityMatchStatus } from '@perfil/shared';
import type { ExtractedDocumentData } from '../entities/validation-record.entity';

/**
 * Candidatos de metadata a partir del texto del documento (§29, paso 5).
 *
 * Son *candidatos*, no hechos. El sistema los usa para decidir si lo declarado
 * es coherente con lo que dice el papel, nunca para sustituir lo que declaró el
 * estudiante ni para afirmar que el documento sea auténtico (§30).
 *
 * Todo funciona por etiquetas en español e inglés, que es como vienen los
 * certificados reales. Cuando una etiqueta no aparece, el campo queda en
 * `null`: preferimos no saber a inventar.
 */

const ETIQUETAS = {
  holder: [
    'otorgado a', 'se otorga a', 'concedido a', 'expedido a', 'certifica que',
    'hace constar que', 'titular', 'nombre del participante', 'participante',
    'awarded to', 'presented to', 'issued to', 'this certifies that', 'holder',
  ],
  issuer: [
    'emitido por', 'otorgado por', 'expedido por', 'emisor', 'institucion',
    'institución', 'issued by', 'awarded by', 'issuer', 'organization',
  ],
  title: [
    'certificado de', 'certificado en', 'diploma de', 'diploma en',
    'constancia de', 'curso', 'certificate of', 'certificate in', 'course',
  ],
  date: [
    'fecha de emision', 'fecha de emisión', 'fecha de expedicion',
    'fecha de expedición', 'fecha', 'emitido el', 'issue date', 'issued on',
    'date of issue', 'date',
  ],
  credential: [
    'credencial', 'codigo de verificacion', 'código de verificación',
    'id de credencial', 'folio', 'numero de certificado', 'número de certificado',
    'credential id', 'certificate id', 'credential', 'serial',
  ],
};

/** Palabras que nunca forman parte de un nombre propio. */
const RUIDO_EN_NOMBRE = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'por', 'para', 'en', 'con',
  'certificado', 'diploma', 'constancia', 'curso', 'participacion',
  'participación', 'the', 'of', 'and', 'for', 'to', 'in',
]);

export function extractMetadata(
  texto: string,
  extras: { links?: string[]; qrPayloads?: string[] } = {},
): Omit<ExtractedDocumentData, 'source' | 'textLength'> {
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);

  return {
    holderName: buscarNombre(lineas),
    issuer: limpiar(buscarEtiqueta(lineas, ETIQUETAS.issuer), 160),
    certificateTitle: buscarTitulo(lineas),
    issueDate: buscarFecha(texto),
    credentialId: buscarCredencial(lineas, texto),
    verificationUrl: buscarUrl(texto, extras),
    qrPayloads: extras.qrPayloads?.length ? extras.qrPayloads : undefined,
  };
}

/* ------------------------------------------------------------------ */

/** Devuelve lo que sigue a cualquiera de las etiquetas, en la misma línea. */
function buscarEtiqueta(lineas: string[], etiquetas: string[]): string | null {
  for (const linea of lineas) {
    const minus = linea.toLowerCase();
    for (const etiqueta of etiquetas) {
      const idx = minus.indexOf(etiqueta);
      if (idx === -1) continue;
      const resto = linea.slice(idx + etiqueta.length).replace(/^[\s:.,-]+/, '').trim();
      if (resto.length >= 2) return resto;
    }
  }
  return null;
}

function buscarNombre(lineas: string[]): string | null {
  const directo = buscarEtiqueta(lineas, ETIQUETAS.holder);
  if (directo) return limpiar(directo, 160);

  // Sin etiqueta: la línea siguiente a «otorgado a» suele llevar el nombre solo.
  for (let i = 0; i < lineas.length - 1; i += 1) {
    const minus = lineas[i].toLowerCase();
    if (ETIQUETAS.holder.some((e) => minus.includes(e)) && pareceNombre(lineas[i + 1])) {
      return limpiar(lineas[i + 1], 160);
    }
  }
  return null;
}

function buscarTitulo(lineas: string[]): string | null {
  for (const linea of lineas) {
    const minus = linea.toLowerCase();
    if (ETIQUETAS.title.some((e) => minus.startsWith(e) || minus.includes(e))) {
      return limpiar(linea, 200);
    }
  }
  // Muchos certificados llevan el título en mayúsculas en la cabecera.
  const cabecera = lineas.slice(0, 3).find((l) => l.length > 8 && l === l.toUpperCase());
  return cabecera ? limpiar(cabecera, 200) : null;
}

/**
 * Fecha en formato ISO.
 *
 * Se prefiere `AAAA-MM-DD` porque no tiene ambigüedad. Para `DD/MM/AAAA` se
 * asume día primero, que es la convención local; si el primer número es mayor
 * que 12 la lectura es inequívoca y se corrige sola.
 */
function buscarFecha(texto: string): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(texto);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const barras = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/.exec(texto);
  if (barras) {
    let dia = Number(barras[1]);
    let mes = Number(barras[2]);
    if (dia > 12 && mes <= 12) {
      // Ya estaba en dia/mes.
    } else if (mes > 12 && dia <= 12) {
      [dia, mes] = [mes, dia];
    }
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return `${barras[3]}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  const MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
    agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
    august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const literal = new RegExp(
    `\\b(\\d{1,2})\\s+(?:de\\s+)?(${Object.keys(MESES).join('|')})\\s+(?:de\\s+)?(\\d{4})\\b`,
    'i',
  ).exec(texto);
  if (literal) {
    const mes = MESES[literal[2].toLowerCase()];
    return `${literal[3]}-${String(mes).padStart(2, '0')}-${String(Number(literal[1])).padStart(2, '0')}`;
  }
  return null;
}

function buscarCredencial(lineas: string[], texto: string): string | null {
  const etiquetado = buscarEtiqueta(lineas, ETIQUETAS.credential);
  if (etiquetado) {
    const token = /[A-Za-z0-9][A-Za-z0-9._-]{3,}/.exec(etiquetado);
    if (token) return token[0].slice(0, 80);
  }
  // Sin etiqueta: un código con letras, cifras y guiones es reconocible por
  // su forma. Se exige mezcla para no confundirlo con una palabra cualquiera.
  const suelto = /\b(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9]{2,}(?:-[A-Z0-9]{2,}){1,4}\b/.exec(texto);
  return suelto ? suelto[0].slice(0, 80) : null;
}

/**
 * URL de verificación.
 *
 * Prioridad: lo que dice un QR, luego las anotaciones de enlace del PDF, y solo
 * después el texto plano, que es donde el OCR más se equivoca.
 */
function buscarUrl(
  texto: string,
  extras: { links?: string[]; qrPayloads?: string[] },
): string | null {
  const desdeQr = (extras.qrPayloads ?? []).find((p) => /^https?:\/\//i.test(p.trim()));
  if (desdeQr) return desdeQr.trim().slice(0, 500);

  const preferida = (extras.links ?? []).find((l) => /verif|valid|credential|check/i.test(l));
  if (preferida) return preferida.slice(0, 500);
  if (extras.links?.length) return extras.links[0].slice(0, 500);

  const enTexto = /https?:\/\/[^\s<>"')]+/i.exec(texto);
  return enTexto ? enTexto[0].replace(/[.,;:]+$/, '').slice(0, 500) : null;
}

function limpiar(valor: string | null, max: number): string | null {
  if (!valor) return null;
  const limpio = valor.replace(/\s+/g, ' ').replace(/^[\s:.,-]+|[\s:.,-]+$/g, '').trim();
  return limpio.length >= 2 ? limpio.slice(0, max) : null;
}

function pareceNombre(linea: string): boolean {
  const palabras = linea.trim().split(/\s+/);
  if (palabras.length < 2 || palabras.length > 6) return false;
  return palabras.every((p) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]{2,}$/.test(p));
}

/* ------------------------------------------------------------------ */
/* Comparación de nombres (§30)                                        */
/* ------------------------------------------------------------------ */

/**
 * Compara el nombre del titular con el que aparece en el documento.
 *
 * Se compara por palabras y no por cadena completa porque los nombres reales
 * no coinciden literalmente casi nunca: sobra un apellido, falta el segundo
 * nombre, cambia el orden o el documento abrevia.
 *
 * `UNKNOWN` cuando no se leyó ningún nombre. `MISMATCH` solo cuando sí se leyó
 * uno y no comparte casi nada: acusar de discrepancia por no haber podido leer
 * sería peor que no decir nada.
 */
export function compareHolderName(
  declarado: string,
  enDocumento: string | null,
): IdentityMatchStatus {
  if (!enDocumento) return IdentityMatchStatus.UNKNOWN;

  const a = tokenizar(declarado);
  const b = tokenizar(enDocumento);
  if (a.length === 0 || b.length === 0) return IdentityMatchStatus.UNKNOWN;

  const comunes = a.filter((t) => b.includes(t));
  if (comunes.length === 0) return IdentityMatchStatus.MISMATCH;

  // Que todas las palabras del nombre declarado esten en el documento basta:
  // el documento puede llevar mas apellidos o un titulo delante.
  if (comunes.length === a.length || comunes.length === b.length) {
    return IdentityMatchStatus.MATCH;
  }
  return comunes.length >= 2 ? IdentityMatchStatus.PARTIAL_MATCH : IdentityMatchStatus.MISMATCH;
}

function tokenizar(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !RUIDO_EN_NOMBRE.has(t));
}
