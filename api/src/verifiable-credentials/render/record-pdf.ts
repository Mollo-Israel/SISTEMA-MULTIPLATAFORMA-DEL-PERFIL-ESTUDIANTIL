import { createHash } from 'node:crypto';
import { encodeQr } from '../../collaboration/qr-encoder';
import { CredentialSourceType } from '../../entities/verifiable-credential.entity';

/**
 * PDF imprimible del registro verificable.
 *
 * Es **determinista**: los mismos datos producen siempre los mismos bytes, sin
 * fecha de creación ni identificadores aleatorios. Así, al verificar un PDF,
 * el sistema lo vuelve a generar y compara byte a byte. Si alguien cambió un
 * nombre, una fecha o una letra, la comparación falla y el verificador lo
 * dice: «este archivo fue modificado».
 *
 * Lleva:
 * - el QR y un enlace activo a la página de verificación;
 * - la credencial Open Badges 3.0 firmada como archivo adjunto
 *   (`registro-verificable.json`);
 * - el código en el diccionario de información (`/AfiniaCode`), para
 *   encontrarlo sin leer el texto.
 *
 * Escrito a mano, sin dependencias: la API no tiene un generador de PDF y
 * uno completo sería mucho más de lo que hace falta para una página.
 */

/** Cambia si cambia el diseño: un PDF viejo se compara con su versión. */
export const RECORD_PDF_VERSION = '1';

export interface RecordPdfInput {
  code: string;
  sourceType: CredentialSourceType;
  achievementName: string;
  holderName: string;
  issuerName: string;
  documentIssuer: string | null;
  documentSha256: string | null;
  occurredAt: Date | null;
  issuedAt: Date;
  narrative: string;
  verifyUrl: string;
  payloadSha256: string;
  keyId: string;
  credentialJson: string;
}

const TIPO: Record<CredentialSourceType, string> = {
  participation: 'Participación confirmada',
  institution_certificate: 'Certificado institucional entregado',
  internal_constancy: 'Constancia histórica',
};

// WinAnsiEncoding: Latin-1 más algunos signos en 0x80–0x9F.
const WIN_ANSI_EXTRA: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99,
};

/** Texto a cadena literal de PDF en WinAnsi, con los escapes de §7.3.4.2. */
function literal(texto: string): string {
  let salida = '';
  for (const ch of texto.normalize('NFC')) {
    const cp = ch.codePointAt(0) ?? 63;
    let byte: number;
    if (WIN_ANSI_EXTRA[ch] !== undefined) byte = WIN_ANSI_EXTRA[ch];
    else if (cp >= 0x20 && cp <= 0x7e) byte = cp;
    else if (cp >= 0xa0 && cp <= 0xff) byte = cp;
    else byte = 0x3f; // «?»
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) salida += `\\${String.fromCharCode(byte)}`;
    else if (byte < 0x20 || byte > 0x7e) salida += `\\${byte.toString(8).padStart(3, '0')}`;
    else salida += String.fromCharCode(byte);
  }
  return `(${salida})`;
}

/** Ancho aproximado de Helvetica (en milésimas de em), suficiente para partir líneas. */
function anchoHelvetica(texto: string, tamano: number, negrita = false): number {
  let total = 0;
  for (const ch of texto) {
    if (ch === ' ') total += 278;
    else if (/[il.,;:'|!]/.test(ch)) total += 250;
    else if (/[fjrt]/.test(ch)) total += 320;
    else if (/[mwMW]/.test(ch)) total += 860;
    else if (/[A-ZÁÉÍÓÚÑ]/.test(ch)) total += 690;
    else if (/[0-9]/.test(ch)) total += 556;
    else total += 540;
  }
  return (total * tamano * (negrita ? 1.06 : 1)) / 1000;
}

function partir(texto: string, tamano: number, ancho: number, negrita = false): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.replace(/\s+/g, ' ').trim().split(' ')) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || anchoHelvetica(candidata, tamano, negrita) <= ancho) actual = candidata;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Fecha en Bolivia (UTC−4, sin horario de verano), formateada sin depender de ICU. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaBolivia(d: Date): string {
  const local = new Date(d.getTime() - 4 * 3600_000);
  return `${local.getUTCDate()} de ${MESES[local.getUTCMonth()]} de ${local.getUTCFullYear()}`;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function renderRecordPdf(i: RecordPdfInput): Buffer {
  const W = 595;
  const H = 842;
  const M = 56;
  const ops: string[] = [];
  const texto = (x: number, y: number, fuente: 'F1' | 'F2' | 'F3', tamano: number, t: string, gris = 0) => {
    ops.push(`BT ${gris ? `${num(gris)} g ` : '0 g '}/${fuente} ${num(tamano)} Tf ${num(x)} ${num(y)} Td ${literal(t)} Tj ET`);
  };

  // Banda superior.
  const color = i.sourceType === 'participation' ? '0.059 0.463 0.431'
    : i.sourceType === 'institution_certificate' ? '0.118 0.227 0.541' : '0.427 0.157 0.851';
  ops.push(`${color} rg 0 ${H - 92} ${W} 92 re f`);
  ops.push(`BT 1 g /F2 22 Tf ${M} ${H - 50} Td ${literal('AFINIA')} Tj ET`);
  ops.push(`BT 1 g /F1 12 Tf ${M} ${H - 72} Td ${literal('Registro verificable · Open Badges 3.0')} Tj ET`);
  ops.push(`BT 1 g /F1 10 Tf ${W - M - anchoHelvetica(TIPO[i.sourceType], 10)} ${H - 50} Td ${literal(TIPO[i.sourceType])} Tj ET`);

  let y = H - 140;
  for (const l of partir(i.achievementName, 20, W - 2 * M, true).slice(0, 3)) {
    texto(M, y, 'F2', 20, l);
    y -= 26;
  }
  y -= 8;

  const fila = (etiqueta: string, valor: string) => {
    texto(M, y, 'F1', 9, etiqueta.toUpperCase(), 0.4);
    y -= 15;
    for (const l of partir(valor, 12, W - 2 * M - 170).slice(0, 2)) {
      texto(M, y, 'F2', 12, l);
      y -= 16;
    }
    y -= 8;
  };
  fila('Titular', i.holderName);
  if (i.occurredAt) fila('Fecha de la actividad', fechaBolivia(i.occurredAt));
  fila('Registrado y firmado', fechaBolivia(i.issuedAt));
  fila('Firmado por', i.issuerName);
  if (i.documentIssuer) fila('Emisor del certificado', i.documentIssuer);

  // Código, destacado.
  texto(M, y, 'F1', 9, 'CÓDIGO DE VERIFICACIÓN', 0.4);
  y -= 22;
  texto(M, y, 'F3', 20, i.code);
  y -= 30;

  // Qué afirma.
  texto(M, y, 'F1', 9, 'QUÉ AFIRMA ESTE REGISTRO', 0.4);
  y -= 15;
  for (const l of partir(i.narrative, 10, W - 2 * M - 170)) {
    texto(M, y, 'F1', 10, l, 0.15);
    y -= 13;
  }

  // QR a la derecha, con su margen blanco.
  const qr = encodeQr(i.verifyUrl);
  const lado = 150;
  const modulo = lado / (qr.size + 8);
  const qx = W - M - lado;
  const qy = H - 140 - lado - 20;
  ops.push(`1 g ${num(qx)} ${num(qy)} ${lado} ${lado} re f 0 g`);
  const rects: string[] = [];
  for (let f = 0; f < qr.size; f += 1) {
    for (let c = 0; c < qr.size; c += 1) {
      if (!qr.modules[f][c]) continue;
      const x = qx + (c + 4) * modulo;
      const yy = qy + lado - (f + 5) * modulo;
      rects.push(`${num(x)} ${num(yy)} ${num(modulo)} ${num(modulo)} re`);
    }
  }
  ops.push(`${rects.join(' ')} f`);
  texto(qx + 18, qy - 14, 'F1', 9, 'Escanee para verificar', 0.35);

  // Pie: cómo se verifica y la huella.
  let py = 150;
  ops.push(`0.85 G 0.6 w ${M} ${py + 16} m ${W - M} ${py + 16} l S`);
  for (const l of partir(
    'Este registro no es un certificado académico. Su validez se comprueba en línea con el código o el QR: '
      + 'una copia impresa que no se verifica no prueba nada. Si el archivo se edita, la verificación lo detecta.',
    9, W - 2 * M,
  )) {
    texto(M, py, 'F1', 9, l, 0.25);
    py -= 12;
  }
  py -= 6;
  texto(M, py, 'F1', 9, 'Verificar en:', 0.4);
  texto(M + 62, py, 'F1', 9, i.verifyUrl, 0.1);
  const enlace = { x1: M + 60, y1: py - 3, x2: M + 64 + anchoHelvetica(i.verifyUrl, 9), y2: py + 10 };
  py -= 16;
  texto(M, py, 'F3', 7, `Huella SHA-256 del registro firmado: ${i.payloadSha256}`, 0.35);
  py -= 10;
  texto(M, py, 'F3', 7, `Firma Ed25519 (eddsa-jcs-2022) con la clave ${i.keyId}. Adjunto: registro-verificable.json`, 0.35);
  if (i.documentSha256) {
    py -= 10;
    texto(M, py, 'F3', 7, `SHA-256 del certificado entregado: ${i.documentSha256}`, 0.35);
  }

  const contenido = Buffer.from(ops.join('\n'), 'latin1');
  const adjunto = Buffer.from(i.credentialJson, 'utf8');

  // Objetos, en orden. El 0 no existe; los índices del arreglo son los números.
  const objetos: Buffer[] = [];
  const obj = (cuerpo: string | Buffer) => {
    objetos.push(typeof cuerpo === 'string' ? Buffer.from(cuerpo, 'latin1') : cuerpo);
    return objetos.length;
  };
  const stream = (dicc: string, datos: Buffer) =>
    Buffer.concat([Buffer.from(`<< ${dicc} /Length ${datos.length} >>\nstream\n`, 'latin1'), datos, Buffer.from('\nendstream', 'latin1')]);

  const catalogo = obj('<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 8 0 R >> >>');
  obj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R /Annots [9 0 R] >>`);
  obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  obj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');
  obj(stream('', contenido));
  obj(`<< /Names [${literal('registro-verificable.json')} 10 0 R] >>`);
  obj(`<< /Type /Annot /Subtype /Link /Rect [${num(enlace.x1)} ${num(enlace.y1)} ${num(enlace.x2)} ${num(enlace.y2)}] /Border [0 0 0] /A << /S /URI /URI ${literal(i.verifyUrl)} >> >>`);
  obj(`<< /Type /Filespec /F ${literal('registro-verificable.json')} /UF ${literal('registro-verificable.json')} /Desc ${literal('Credencial Open Badges 3.0 firmada')} /AFRelationship /Data /EF << /F 11 0 R >> >>`);
  obj(stream(`/Type /EmbeddedFile /Subtype /application#2Fjson /Params << /Size ${adjunto.length} >>`, adjunto));
  const info = obj(
    `<< /Title ${literal(`Registro verificable ${i.code}`)} /Author ${literal(i.issuerName)} /Producer ${literal('Afinia')} `
      + `/AfiniaCode ${literal(i.code)} /AfiniaPdfVersion ${literal(RECORD_PDF_VERSION)} >>`,
  );

  const partes: Buffer[] = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets: number[] = [];
  let pos = partes[0].length;
  objetos.forEach((o, n) => {
    const cabeza = Buffer.from(`${n + 1} 0 obj\n`, 'latin1');
    const cola = Buffer.from('\nendobj\n', 'latin1');
    offsets.push(pos);
    partes.push(cabeza, o, cola);
    pos += cabeza.length + o.length + cola.length;
  });
  const xref = [`xref\n0 ${objetos.length + 1}\n`, '0000000000 65535 f \n', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  // /ID determinista: la huella del registro, no un número aleatorio.
  const id = createHash('md5').update(`${i.code}|${i.payloadSha256}|${RECORD_PDF_VERSION}`).digest('hex');
  partes.push(Buffer.from(
    `${xref}trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${pos}\n%%EOF\n`,
    'latin1',
  ));
  return Buffer.concat(partes);
}

/** El código y la versión que lleva un PDF de Afinia, si los lleva. */
export function readRecordPdfMarker(buffer: Buffer): { code: string; version: string } | null {
  const cabeza = buffer.subarray(0, 8).toString('latin1');
  if (!cabeza.startsWith('%PDF-')) return null;
  const texto = buffer.toString('latin1');
  const code = /\/AfiniaCode \((AF-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5})\)/.exec(texto);
  const version = /\/AfiniaPdfVersion \(([0-9]{1,3})\)/.exec(texto);
  return code ? { code: code[1], version: version?.[1] ?? '?' } : null;
}
