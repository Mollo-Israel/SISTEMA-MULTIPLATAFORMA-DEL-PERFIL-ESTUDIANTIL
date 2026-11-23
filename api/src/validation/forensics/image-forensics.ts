import { inflateSync } from 'node:zlib';
import {
  ForensicReport,
  agregarSenal,
  clasificarPrograma,
  emptyReport,
  fuenteIa,
  generadorIa,
  recortar,
} from './forensic-report';
import { bloqueXmp, programasDeXmp } from './pdf-forensics';

/**
 * V9 · Lectura forense de una imagen PNG o JPEG, sin dependencias nuevas.
 *
 *  - PNG: bloques de texto (tEXt, iTXt, zTXt), EXIF (eXIf) y C2PA (caBX).
 *  - JPEG: EXIF (APP1), XMP (APP1), Photoshop (APP13) y C2PA/JUMBF (APP11).
 *
 * Marcas de IA que se reconocen, todas escritas por la propia herramienta:
 *  - IPTC DigitalSourceType «trainedAlgorithmicMedia» (XMP o C2PA): lo usan
 *    OpenAI, Adobe Firefly, Google, Microsoft y Meta;
 *  - el generador del manifiesto C2PA (claim_generator);
 *  - parámetros de Stable Diffusion (AUTOMATIC1111 «parameters», ComfyUI
 *    «prompt»/«workflow», InvokeAI, NovelAI).
 *
 * Además, un hash perceptual (dHash de 256 bits) para reconocer la misma
 * imagen aunque se haya vuelto a comprimir o recortar levemente.
 */

const PNG_FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_PIXELES = 40_000_000;
const MAX_TEXTO_BLOQUE = 256 * 1024;

/** Claves de texto PNG que solo escriben los generadores de imágenes con IA. */
const CLAVES_PNG_IA = new Set(['parameters', 'prompt', 'workflow', 'dream', 'invokeai_metadata', 'sd-metadata', 'generation_data']);

export function analyzeImage(buffer: Buffer, mimeType: string): ForensicReport {
  const report = emptyReport('image');
  const meta = mimeType === 'image/png' ? leerPng(buffer) : mimeType === 'image/jpeg' ? leerJpeg(buffer) : null;
  if (!meta) return report;

  const programas = [...meta.programas];
  for (const x of meta.xmp) programas.push(...programasDeXmp(x));
  report.creator = programas[0] ?? null;
  report.producer = programas.find((p) => clasificarPrograma(p)) ?? null;
  report.createdAt = meta.fecha;

  for (const p of programas) {
    agregarSenal(report.signals, clasificarPrograma(p));
    const ia = generadorIa(p);
    if (ia) agregarSenal(report.signals, { code: 'ai_generated', severity: 'critical', detail: ia });
  }
  for (const x of [...meta.xmp, ...meta.c2pa]) {
    const ia = fuenteIa(x);
    if (ia) agregarSenal(report.signals, { code: 'ai_generated', severity: 'critical', detail: ia });
  }
  for (const clave of meta.clavesIa) {
    agregarSenal(report.signals, { code: 'ai_generated', severity: 'critical', detail: `Parámetros de generación («${clave}»)` });
  }
  if (meta.photoshop) agregarSenal(report.signals, { code: 'image_editor', severity: 'warning', detail: 'Bloque de Adobe Photoshop (8BIM)' });
  if (meta.c2pa.length > 0) {
    const gen = meta.c2pa.map(generadorC2pa).find(Boolean) ?? null;
    const ia = generadorIa(gen);
    if (ia) agregarSenal(report.signals, { code: 'ai_generated', severity: 'critical', detail: `C2PA · ${ia}` });
    else if (!report.signals.some((s) => s.code === 'ai_generated')) {
      agregarSenal(report.signals, { code: 'content_credentials', severity: 'info', detail: gen ? `C2PA · ${gen}` : 'Manifiesto C2PA' });
      agregarSenal(report.signals, clasificarPrograma(gen));
    }
  }

  try {
    report.perceptualHash = dHashDeImagen(buffer, mimeType);
  } catch {
    report.perceptualHash = null;
  }
  return report;
}

/* ======================================================================= */

interface MetaImagen {
  programas: string[];
  xmp: string[];
  /** Manifiestos C2PA como texto latin1 (CBOR con cadenas legibles). */
  c2pa: string[];
  clavesIa: string[];
  photoshop: boolean;
  fecha: string | null;
}

const vacia = (): MetaImagen => ({ programas: [], xmp: [], c2pa: [], clavesIa: [], photoshop: false, fecha: null });

export function leerPng(png: Buffer): MetaImagen | null {
  if (png.length < 16 || !png.subarray(0, 8).equals(PNG_FIRMA)) return null;
  const m = vacia();
  let off = 8;
  for (let n = 0; n < 4000 && off + 12 <= png.length; n += 1) {
    const largo = png.readUInt32BE(off);
    const tipo = png.toString('latin1', off + 4, off + 8);
    const ini = off + 8;
    const fin = ini + largo;
    if (fin + 4 > png.length) break;
    const datos = png.subarray(ini, fin);
    if (tipo === 'tEXt' || tipo === 'iTXt' || tipo === 'zTXt') {
      const t = textoPng(tipo, datos);
      if (t) procesarTextoPng(m, t.clave, t.valor);
    } else if (tipo === 'eXIf') {
      procesarExif(m, datos);
    } else if (tipo === 'caBX') {
      m.c2pa.push(datos.subarray(0, MAX_TEXTO_BLOQUE).toString('latin1'));
    } else if (tipo === 'IEND') {
      break;
    }
    off = fin + 4;
  }
  return m;
}

function textoPng(tipo: string, d: Buffer): { clave: string; valor: string } | null {
  const cero = d.indexOf(0);
  if (cero <= 0) return null;
  const clave = d.toString('latin1', 0, cero);
  try {
    if (tipo === 'tEXt') return { clave, valor: d.subarray(cero + 1, cero + 1 + MAX_TEXTO_BLOQUE).toString('latin1') };
    if (tipo === 'zTXt') return { clave, valor: inflateSync(d.subarray(cero + 2), { maxOutputLength: MAX_TEXTO_BLOQUE }).toString('latin1') };
    // iTXt: clave\0 compresión método idioma\0 traducida\0 texto
    const comprimido = d[cero + 1] === 1;
    let p = cero + 3;
    p = d.indexOf(0, p) + 1;
    p = d.indexOf(0, p) + 1;
    if (p <= 0) return null;
    const cuerpo = d.subarray(p);
    const valor = comprimido ? inflateSync(cuerpo, { maxOutputLength: MAX_TEXTO_BLOQUE }) : cuerpo.subarray(0, MAX_TEXTO_BLOQUE);
    return { clave, valor: valor.toString('utf8') };
  } catch {
    return null;
  }
}

function procesarTextoPng(m: MetaImagen, clave: string, valor: string): void {
  const k = clave.toLowerCase();
  if (k === 'xml:com.adobe.xmp') {
    const x = bloqueXmp(valor);
    if (x) m.xmp.push(x);
    return;
  }
  if (k === 'software' || k === 'source' || k === 'creator' || k === 'creation software') {
    m.programas.push(recortar(valor, 160));
    return;
  }
  if (k === 'creation time' && !m.fecha) {
    const f = new Date(valor);
    if (!Number.isNaN(f.getTime())) m.fecha = f.toISOString();
    return;
  }
  // `parameters` de AUTOMATIC1111 lleva «Steps:» y «Sampler:»; ComfyUI guarda
  // JSON del grafo en `prompt` y `workflow`. Se exige el contenido típico para
  // no confundir un `prompt` cualquiera.
  if (CLAVES_PNG_IA.has(k)) {
    const tipico = k === 'parameters' ? /Steps:\s*\d+/.test(valor) && /(Sampler|CFG scale|Seed):/i.test(valor)
      : k === 'prompt' || k === 'workflow' ? /class_type|"nodes"\s*:|KSampler|CheckpointLoader/.test(valor)
        : true;
    if (tipico) m.clavesIa.push(clave);
  }
  if (k === 'comment' && /"(sampler|steps|scale|n_samples|uc)"\s*:/.test(valor)) m.clavesIa.push(clave);
}

export function leerJpeg(jpg: Buffer): MetaImagen | null {
  if (jpg.length < 4 || jpg[0] !== 0xff || jpg[1] !== 0xd8) return null;
  const m = vacia();
  let off = 2;
  for (let n = 0; n < 500 && off + 4 <= jpg.length; n += 1) {
    if (jpg[off] !== 0xff) break;
    const marcador = jpg[off + 1];
    if (marcador === 0xd8 || (marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01) { off += 2; continue; }
    if (marcador === 0xda || marcador === 0xd9) break; // empieza la imagen: ya no hay metadatos
    const largo = jpg.readUInt16BE(off + 2);
    const datos = jpg.subarray(off + 4, Math.min(jpg.length, off + 2 + largo));
    if (marcador === 0xe1) {
      if (datos.subarray(0, 6).toString('latin1') === 'Exif\0\0') procesarExif(m, datos.subarray(6));
      else if (datos.toString('latin1', 0, 29) === 'http://ns.adobe.com/xap/1.0/\0') {
        const x = bloqueXmp(datos.subarray(29).toString('utf8'));
        if (x) m.xmp.push(x);
      }
    } else if (marcador === 0xed && datos.toString('latin1', 0, 13) === 'Photoshop 3.0') {
      m.photoshop = true;
    } else if (marcador === 0xeb && /jumb|c2pa/.test(datos.subarray(0, 64).toString('latin1'))) {
      m.c2pa.push(datos.subarray(0, MAX_TEXTO_BLOQUE).toString('latin1'));
    } else if (marcador === 0xfe) {
      const comentario = datos.subarray(0, 2048).toString('latin1');
      if (/"(sampler|steps|n_samples)"\s*:|Steps:\s*\d+.*Sampler:/i.test(comentario)) m.clavesIa.push('COM');
    }
    off += 2 + largo;
  }
  return m;
}

/** EXIF (TIFF): Software (0x0131), DateTime (0x0132) y Artist (0x013b) del IFD0. */
export function procesarExif(m: MetaImagen, tiff: Buffer): void {
  try {
    if (tiff.length < 8) return;
    const le = tiff.toString('latin1', 0, 2) === 'II';
    const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
    const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
    const ifd = u32(4);
    if (ifd + 2 > tiff.length) return;
    const n = Math.min(u16(ifd), 200);
    for (let i = 0; i < n; i += 1) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > tiff.length) break;
      const tag = u16(e);
      if (tag !== 0x0131 && tag !== 0x0132) continue;
      const cuenta = u32(e + 4);
      const donde = cuenta <= 4 ? e + 8 : u32(e + 8);
      if (donde + cuenta > tiff.length || cuenta > 512) continue;
      const valor = tiff.toString('latin1', donde, donde + cuenta).replace(/\0+$/, '').trim();
      if (!valor) continue;
      if (tag === 0x0131) m.programas.push(recortar(valor, 160));
      if (tag === 0x0132 && !m.fecha) {
        const f = new Date(valor.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
        if (!Number.isNaN(f.getTime())) m.fecha = f.toISOString();
      }
    }
  } catch {
    // EXIF malformado: se ignora.
  }
}

/** `claim_generator` de un manifiesto C2PA (cadena CBOR que le sigue). */
export function generadorC2pa(manifiesto: string): string | null {
  const i = manifiesto.indexOf('claim_generator');
  if (i === -1) return null;
  const tras = manifiesto.slice(i + 15, i + 300);
  // En CBOR la cadena va precedida de su cabecera: 0x60–0x77 (largo en el
  // propio byte, que además es imprimible: «k», «p»…), 0x78 (+1 byte) o 0x79
  // (+2 bytes). Se respeta el largo declarado para no comerse esa letra.
  const b = tras.charCodeAt(0);
  let inicio = -1;
  let largo = 0;
  if (b >= 0x60 && b <= 0x77) { inicio = 1; largo = b - 0x60; } else if (b === 0x78) { inicio = 2; largo = tras.charCodeAt(1); } else if (b === 0x79) { inicio = 3; largo = tras.charCodeAt(1) * 256 + tras.charCodeAt(2); }
  if (inicio > 0 && largo > 0) {
    const valor = tras.slice(inicio, inicio + largo);
    if (/^[\x20-\x7e]+$/.test(valor)) return recortar(valor, 120);
  }
  const m =/[\x20-\x7e]{3,120}/.exec(tras.replace(/^[^\x20-\x7e]*/, ''));
  return m ? recortar(m[0], 120) : null;
}

/* ======================================================================= */
//  Hash perceptual
/* ======================================================================= */

/**
 * dHash de 256 bits: la imagen en gris reducida a 17×16 y, por fila, si cada
 * celda es más clara que la siguiente. Sobrevive a recompresión, cambio de
 * tamaño y leves ajustes de brillo; cambia si cambia el contenido.
 */
export function dHashDeImagen(buffer: Buffer, mimeType: string): string | null {
  const px = decodificar(buffer, mimeType);
  if (!px) return null;
  const W = 17;
  const H = 16;
  const gris = reducir(px.data, px.width, px.height, W, H);
  let bits = '';
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W - 1; x += 1) bits += gris[y * W + x] > gris[y * W + x + 1] ? '1' : '0';
  }
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Bits distintos entre dos hashes hexadecimales del mismo largo. */
export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

function decodificar(buffer: Buffer, mimeType: string): { data: Uint8Array; width: number; height: number } | null {
  if (mimeType === 'image/png') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { PNG } = require('pngjs');
    const png = PNG.sync.read(buffer);
    return png.width * png.height > MAX_PIXELES ? null : { data: png.data, width: png.width, height: png.height };
  }
  if (mimeType === 'image/jpeg') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const jpeg = require('jpeg-js');
    const img = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 256 });
    return img.width * img.height > MAX_PIXELES ? null : { data: img.data, width: img.width, height: img.height };
  }
  return null;
}

/** Promedio por área a W×H en escala de grises (luma BT.601). */
function reducir(rgba: Uint8Array, w: number, h: number, W: number, H: number): number[] {
  const out = new Array<number>(W * H).fill(0);
  const cuenta = new Array<number>(W * H).fill(0);
  // Se muestrea como mucho ~1 millón de píxeles: suficiente para 17×16.
  const paso = Math.max(1, Math.floor(Math.sqrt((w * h) / 1_000_000)));
  for (let y = 0; y < h; y += paso) {
    const cy = Math.min(H - 1, Math.floor((y * H) / h));
    for (let x = 0; x < w; x += paso) {
      const cx = Math.min(W - 1, Math.floor((x * W) / w));
      const i = (y * w + x) * 4;
      out[cy * W + cx] += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      cuenta[cy * W + cx] += 1;
    }
  }
  return out.map((v, i) => (cuenta[i] ? v / cuenta[i] : 0));
}
