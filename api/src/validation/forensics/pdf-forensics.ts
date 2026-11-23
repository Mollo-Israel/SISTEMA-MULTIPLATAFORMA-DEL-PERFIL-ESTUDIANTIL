import { decodificar, esPdf, recorrerStreams } from '../pdf-text';
import {
  ForensicReport,
  ForensicSignal,
  agregarSenal,
  clasificarPrograma,
  emptyReport,
  fuenteIa,
  generadorIa,
  recortar,
} from './forensic-report';

/**
 * V9 · Lectura forense de un PDF, sin dependencias.
 *
 * Qué mira:
 *  - los diccionarios /Info de todas las revisiones (Producer, Creator,
 *    fechas) y el XMP (CreatorTool, historial de guardado, origen IA);
 *  - cuántas veces se guardó el archivo sobre sí mismo (actualizaciones
 *    incrementales, cada una termina en `%%EOF`);
 *  - las firmas digitales: dónde están, qué cubren y qué viene después.
 *
 * La comprobación criptográfica de la firma vive en `pdf-signature.ts`; aquí
 * solo se localizan los bytes. Todo está acotado: un PDF malformado o enorme
 * no puede colgar al worker.
 */

/** Firma localizada en el archivo, todavía sin comprobar. */
export interface PdfSignatureLocation {
  byteRange: [number, number, number, number];
  /** DER del PKCS#7/CMS (sin el relleno de ceros). */
  contents: Buffer;
  subFilter: string | null;
  /** Fin de lo firmado (offset del último byte cubierto + 1). */
  end: number;
}

export interface PdfForensics {
  report: ForensicReport;
  signatures: PdfSignatureLocation[];
}

/** Límite de bytes descomprimidos que se examinan en busca de metadatos. */
const MAX_DECODIFICADO = 8 * 1024 * 1024;
/** Límite de firmas que se procesan: un certificado real trae una o dos. */
const MAX_FIRMAS = 5;
/** Tolerancia entre creación y modificación antes de considerarlo «modificado después». */
const UN_DIA_MS = 24 * 60 * 60 * 1000;

export function analyzePdf(buffer: Buffer, now: Date = new Date()): PdfForensics {
  const report = emptyReport('pdf');
  if (!esPdf(buffer)) return { report, signatures: [] };

  const crudo = buffer.toString('latin1');
  // Los diccionarios pueden estar en claro o dentro de flujos de objetos
  // comprimidos (PDF 1.5+). Se juntan ambos para buscar.
  const fuentes = [crudo, ...flujosDecodificados(buffer)];

  const productores = new Set<string>();
  const creadores = new Set<string>();
  const creaciones: Date[] = [];
  const modificaciones: Date[] = [];

  for (const texto of fuentes) {
    for (const v of valoresDeClave(texto, 'Producer')) productores.add(v);
    for (const v of valoresDeClave(texto, 'Creator')) creadores.add(v);
    for (const v of valoresDeClave(texto, 'CreationDate')) { const d = fechaPdf(v); if (d) creaciones.push(d); }
    for (const v of valoresDeClave(texto, 'ModDate')) { const d = fechaPdf(v); if (d) modificaciones.push(d); }
  }

  const xmp = fuentes.map(bloqueXmp).filter((x): x is string => !!x);
  const programasXmp = xmp.flatMap(programasDeXmp);
  for (const p of programasXmp) creadores.add(p);
  for (const bloque of xmp) {
    for (const d of etiquetasXmp(bloque, 'xmp:CreateDate')) { const f = fechaIso(d); if (f) creaciones.push(f); }
    for (const d of etiquetasXmp(bloque, 'xmp:ModifyDate')) { const f = fechaIso(d); if (f) modificaciones.push(f); }
  }

  report.producer = primero(productores);
  report.creator = primero(creadores);
  const creada = minimo(creaciones);
  const modificada = maximo(modificaciones);
  report.createdAt = creada?.toISOString() ?? null;
  report.modifiedAt = modificada?.toISOString() ?? null;

  // ---------------------------------------------------------- programas
  for (const p of [...productores, ...creadores]) {
    agregarSenal(report.signals, clasificarPrograma(p));
    const ia = generadorIa(p);
    if (ia) agregarSenal(report.signals, { code: 'ai_generated', severity: 'critical', detail: ia });
  }
  for (const bloque of xmp) {
    const ia = fuenteIa(bloque);
    if (ia) agregarSenal(report.signals, { code: 'ai_generated', severity: 'critical', detail: ia });
  }

  // ------------------------------------------------------------- fechas
  if (creada && modificada && modificada.getTime() - creada.getTime() > UN_DIA_MS) {
    agregarSenal(report.signals, {
      code: 'modified_later',
      severity: 'warning',
      detail: `creado ${creada.toISOString().slice(0, 10)}, modificado ${modificada.toISOString().slice(0, 10)}`,
    });
  }
  const futura = [...creaciones, ...modificaciones].find((d) => d.getTime() - now.getTime() > UN_DIA_MS);
  if (futura) {
    agregarSenal(report.signals, { code: 'future_date', severity: 'warning', detail: futura.toISOString().slice(0, 10) });
  }

  // -------------------------------------------------------- revisiones
  report.revisions = contarRevisiones(buffer);

  // ------------------------------------------------------------ firmas
  const signatures = localizarFirmas(buffer);
  if (signatures.length === 0 && report.revisions > 1) {
    // Un PDF sin firma que se guardó varias veces sobre sí mismo: alguien lo
    // abrió con un editor y guardó cambios. Puede ser inocente (rellenar un
    // formulario), por eso es una advertencia y no una acusación.
    agregarSenal(report.signals, { code: 'incremental_edits', severity: 'warning', detail: `${report.revisions} revisiones` });
  }
  const ultima = signatures.reduce<PdfSignatureLocation | null>((a, s) => (!a || s.end > a.end ? s : a), null);
  if (ultima) {
    const resto = buffer.subarray(ultima.end);
    if (resto.toString('latin1').trim().length > 0 && !esAgregadoBenigno(resto, buffer.subarray(0, ultima.end))) {
      agregarSenal(report.signals, {
        code: 'modified_after_signature',
        severity: 'critical',
        detail: `${resto.length} bytes agregados después de la última firma`,
      });
    }
  }

  return { report, signatures };
}

/* ======================================================================= */

function* flujosDecodificados(buffer: Buffer): Generator<string> {
  let total = 0;
  for (const s of recorrerStreams(buffer)) {
    if (total > MAX_DECODIFICADO) return;
    const texto = decodificar(s.datos, s.filtros);
    if (!texto) continue;
    // Solo interesan los flujos que pueden tener metadatos: los de objetos y
    // el XMP. El contenido de página es la mayoría y no aporta aquí.
    if (!/\/(Producer|Creator|CreationDate|ModDate)\b|<x:xmpmeta|<rdf:RDF/.test(texto)) continue;
    total += texto.length;
    yield texto;
  }
}

/** Valores de `/Clave (cadena)` o `/Clave <hex>` en todo el texto. */
export function valoresDeClave(texto: string, clave: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`/${clave}\\s*([(<])`, 'g');
  let m: RegExpExecArray | null;
  let vueltas = 0;
  while ((m = re.exec(texto)) && vueltas < 50) {
    vueltas += 1;
    const inicio = m.index + m[0].length - 1;
    const valor = m[1] === '(' ? cadenaLiteral(texto, inicio) : cadenaHex(texto, inicio);
    if (valor && valor.trim()) out.push(recortar(valor, 160));
  }
  return out;
}

/** Cadena literal `( … )` con escapes y paréntesis anidados. */
function cadenaLiteral(texto: string, abre: number): string | null {
  let nivel = 0;
  const bytes: number[] = [];
  for (let i = abre; i < texto.length && i < abre + 2000; i += 1) {
    const c = texto[i];
    if (c === '\\') {
      const n = texto[i + 1];
      const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
      if (n in escapes) { bytes.push(escapes[n]); i += 1; continue; }
      const oct = /^[0-7]{1,3}/.exec(texto.slice(i + 1, i + 4));
      if (oct) { bytes.push(parseInt(oct[0], 8) & 0xff); i += oct[0].length; continue; }
      i += 1;
      continue;
    }
    if (c === '(') { nivel += 1; if (nivel === 1) continue; }
    if (c === ')') { nivel -= 1; if (nivel === 0) return decodificarCadenaPdf(Buffer.from(bytes)); }
    bytes.push(texto.charCodeAt(i) & 0xff);
  }
  return null;
}

function cadenaHex(texto: string, abre: number): string | null {
  const cierra = texto.indexOf('>', abre);
  if (cierra === -1 || cierra - abre > 4000) return null;
  const hex = texto.slice(abre + 1, cierra).replace(/[^0-9a-fA-F]/g, '');
  return decodificarCadenaPdf(Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex'));
}

/** UTF-16BE con BOM, UTF-8 con BOM o PDFDocEncoding (≈ latin1). */
function decodificarCadenaPdf(b: Buffer): string {
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    const sinBom = b.subarray(2);
    const par = sinBom.length - (sinBom.length % 2);
    const le = Buffer.alloc(par);
    for (let i = 0; i < par; i += 2) { le[i] = sinBom[i + 1]; le[i + 1] = sinBom[i]; }
    return le.toString('utf16le');
  }
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return b.subarray(3).toString('utf8');
  return b.toString('latin1');
}

/** `D:YYYYMMDDHHmmSSOHH'mm'` → Date. */
export function fechaPdf(v: string): Date | null {
  const m = /D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+-])?(\d{2})?'?(\d{2})?/.exec(v.trim());
  if (!m) return null;
  const [, y, mo = '01', d = '01', h = '00', mi = '00', s = '00', signo, oh = '00', om = '00'] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${!signo || /z/i.test(signo) ? 'Z' : `${signo}${oh}:${om}`}`;
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) || fecha.getUTCFullYear() < 1990 ? null : fecha;
}

function fechaIso(v: string): Date | null {
  const f = new Date(v.trim());
  return Number.isNaN(f.getTime()) || f.getUTCFullYear() < 1990 ? null : f;
}

export function bloqueXmp(texto: string): string | null {
  const i = texto.indexOf('<x:xmpmeta');
  const j = i === -1 ? texto.indexOf('<rdf:RDF') : i;
  if (j === -1) return null;
  const fin = texto.indexOf(i === -1 ? '</rdf:RDF>' : '</x:xmpmeta>', j);
  return texto.slice(j, fin === -1 ? Math.min(texto.length, j + 200_000) : fin + 12).slice(0, 200_000);
}

/** Valores de una propiedad XMP, como atributo o como elemento. */
export function etiquetasXmp(xmp: string, nombre: string): string[] {
  const out: string[] = [];
  const esc = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of xmp.matchAll(new RegExp(`${esc}="([^"]{1,300})"`, 'g'))) out.push(m[1]);
  for (const m of xmp.matchAll(new RegExp(`<${esc}>([^<]{1,300})</${esc}>`, 'g'))) out.push(m[1]);
  return out.map(desescaparXml);
}

/** Programas que tocaron el archivo según el XMP: CreatorTool, Producer y el historial. */
export function programasDeXmp(xmp: string): string[] {
  return [
    ...etiquetasXmp(xmp, 'xmp:CreatorTool'),
    ...etiquetasXmp(xmp, 'pdf:Producer'),
    ...etiquetasXmp(xmp, 'stEvt:softwareAgent'),
  ].map((p) => recortar(p, 160)).filter(Boolean);
}

function desescaparXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/**
 * Revisiones = marcas `%%EOF`. Un PDF linealizado («optimizado para la web»)
 * trae dos de fábrica, así que se descuenta una.
 */
export function contarRevisiones(buffer: Buffer): number {
  const marca = Buffer.from('%%EOF', 'latin1');
  let n = 0;
  let desde = 0;
  while (n < 1000) {
    const i = buffer.indexOf(marca, desde);
    if (i === -1) break;
    n += 1;
    desde = i + marca.length;
  }
  const linealizado = /\/Linearized\s/.test(buffer.subarray(0, 2048).toString('latin1'));
  return Math.max(1, linealizado && n > 1 ? n - 1 : n);
}

/** Localiza las firmas: /ByteRange y el /Contents que queda en el hueco. */
export function localizarFirmas(buffer: Buffer): PdfSignatureLocation[] {
  const texto = buffer.toString('latin1');
  const out: PdfSignatureLocation[] = [];
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) && out.length < MAX_FIRMAS) {
    const r = [m[1], m[2], m[3], m[4]].map(Number) as [number, number, number, number];
    const [a, b, c, d] = r;
    // Un rango inválido no es una firma (o es una manipulación burda).
    if (a !== 0 || b <= 0 || c <= b || d < 0 || c + d > buffer.length) continue;
    const hueco = buffer.subarray(b, c).toString('latin1').trim();
    if (!hueco.startsWith('<') || !hueco.endsWith('>')) continue;
    const hex = hueco.slice(1, -1).replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length < 20) continue;
    const relleno = Buffer.from(hex.length % 2 ? `${hex}0` : hex, 'hex');
    // El hueco se reserva con ceros de sobra; el largo real lo dice el DER.
    const largo = largoDer(relleno);
    if (largo === null) continue;
    const contexto = texto.slice(Math.max(0, m.index - 3000), Math.min(texto.length, m.index + 3000));
    const sub = /\/SubFilter\s*\/([A-Za-z0-9.#_-]+)/.exec(contexto);
    out.push({
      byteRange: r,
      contents: relleno.subarray(0, largo),
      subFilter: sub ? sub[1] : null,
      end: c + d,
    });
  }
  return out;
}

/**
 * Lo agregado después de la **última** firma es benigno solo si es
 * información de validación a largo plazo (LTV): el diccionario DSS/VRI, el
 * catálogo reescrito para apuntarlo y flujos **nuevos** con certificados,
 * respuestas OCSP o CRL. Todo eso lo agregan los firmadores legítimamente.
 *
 * Cualquier otra cosa es una edición posterior a la firma: una página, una
 * anotación, una fuente o —el truco más fino— volver a definir un objeto que
 * ya existía (por ejemplo, el flujo de contenido de la página con otro nombre).
 * Por eso un flujo nuevo solo se acepta si su número de objeto no existía.
 */
export function esAgregadoBenigno(resto: Buffer, firmado: Buffer): boolean {
  const t = resto.toString('latin1');
  const objetos = [...t.matchAll(/(\d+)\s+\d+\s+obj\b([\s\S]*?)endobj/g)].map((m) => ({ num: Number(m[1]), cuerpo: m[2] }));
  if (objetos.length === 0) {
    // Solo una tabla de referencias y un trailer: nada nuevo.
    return !/\/Type\s*\/(Page|Annot|Font|XObject)\b/.test(t);
  }
  const existentes = new Set<number>();
  for (const m of firmado.toString('latin1').matchAll(/(\d+)\s+\d+\s+obj\b/g)) existentes.add(Number(m[1]));

  return objetos.every(({ num, cuerpo }) => {
    if (/\/Type\s*\/Catalog\b/.test(cuerpo)) return /\/DSS\b/.test(cuerpo) && !/\/(OpenAction|AA|JavaScript)\b/.test(cuerpo);
    if (/\/Type\s*\/XRef\b/.test(cuerpo)) return true;
    if (existentes.has(num)) return false;
    if (/\/(DSS|VRI)\b/.test(cuerpo) && !/\/Type\s*\/(Page|Annot|Font|XObject)\b/.test(cuerpo)) return true;
    // Flujo de datos LTV: diccionario con solo /Length, /Filter y /DL.
    const dic = /^\s*<<([\s\S]*?)>>\s*stream/.exec(cuerpo);
    if (!dic) return false;
    const claves = [...dic[1].matchAll(/\/([A-Za-z]+)/g)].map((m) => m[1]).filter((k) => k !== 'FlateDecode');
    return claves.every((k) => k === 'Length' || k === 'Filter' || k === 'DL');
  });
}

/** Largo total de un SEQUENCE DER (cabecera incluida), o null si no lo es. */
export function largoDer(b: Buffer): number | null {
  if (b.length < 2 || b[0] !== 0x30) return null;
  const l = b[1];
  if (l < 0x80) return 2 + l <= b.length ? 2 + l : null;
  const n = l & 0x7f;
  if (n === 0 || n > 4 || b.length < 2 + n) return null;
  let largo = 0;
  for (let i = 0; i < n; i += 1) largo = largo * 256 + b[2 + i];
  const total = 2 + n + largo;
  return total <= b.length ? total : null;
}

function primero(s: Set<string>): string | null {
  const v = [...s][0];
  return v ?? null;
}

function minimo(ds: Date[]): Date | null {
  return ds.length ? new Date(Math.min(...ds.map((d) => d.getTime()))) : null;
}

function maximo(ds: Date[]): Date | null {
  return ds.length ? new Date(Math.max(...ds.map((d) => d.getTime()))) : null;
}

export type { ForensicSignal };
