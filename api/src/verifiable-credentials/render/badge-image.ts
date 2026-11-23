import { crc32 } from '../crypto/codec';
import { CredentialSourceType } from '../../entities/verifiable-credential.entity';

/**
 * Imagen de la insignia y su versión «horneada» (Open Badges Baking 3.0).
 *
 * Una insignia horneada es una imagen que lleva la credencial firmada dentro:
 * - SVG: en un elemento `<openbadges:credential>` (§5.3.2 del estándar).
 * - PNG: en un bloque `iTXt` con la clave `openbadgecredential` (§5.3.1).
 * Quien recibe solo la imagen tiene todo lo necesario para verificarla.
 */

const COLORES: Record<CredentialSourceType, { fondo: string; borde: string; rgb: [number, number, number] }> = {
  participation: { fondo: '#0f766e', borde: '#134e4a', rgb: [15, 118, 110] },
  institution_certificate: { fondo: '#1e3a8a', borde: '#172554', rgb: [30, 58, 138] },
  internal_constancy: { fondo: '#6d28d9', borde: '#4c1d95', rgb: [109, 40, 217] },
};

const ETIQUETA: Record<CredentialSourceType, string> = {
  participation: 'PARTICIPACIÓN',
  institution_certificate: 'CERTIFICADO ENTREGADO',
  internal_constancy: 'CONSTANCIA HISTÓRICA',
};

const escaparXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Parte un título en hasta `max` líneas de unos `ancho` caracteres. */
export function partirTitulo(titulo: string, ancho = 20, max = 3): string[] {
  const palabras = titulo.replace(/\s+/g, ' ').trim().split(' ');
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const candidata = actual ? `${actual} ${p}` : p;
    if (candidata.length <= ancho || !actual) {
      actual = candidata;
    } else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > max) {
    const recortadas = lineas.slice(0, max);
    recortadas[max - 1] = `${recortadas[max - 1].slice(0, ancho - 1)}…`;
    return recortadas.map((l) => (l.length > ancho + 4 ? `${l.slice(0, ancho)}…` : l));
  }
  return lineas.map((l) => (l.length > ancho + 4 ? `${l.slice(0, ancho)}…` : l));
}

export function badgeSvg(
  input: { title: string; sourceType: CredentialSourceType; code: string },
  horneado?: { credentialJson: string },
): string {
  const c = COLORES[input.sourceType];
  const lineas = partirTitulo(input.title);
  const y0 = 196 - (lineas.length - 1) * 13;
  const texto = lineas
    .map((l, i) => `<text x="200" y="${y0 + i * 26}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="21" font-weight="700" fill="#ffffff">${escaparXml(l)}</text>`)
    .join('');
  const ns = horneado ? ' xmlns:openbadges="https://purl.imsglobal.org/ob/v3p0"' : '';
  // CDATA no puede contener «]]>»: se parte si apareciera.
  const carga = horneado
    ? `<openbadges:credential><![CDATA[${horneado.credentialJson.replace(/]]>/g, ']]]]><![CDATA[>')}]]></openbadges:credential>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<svg xmlns="http://www.w3.org/2000/svg"${ns} width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="${escaparXml(input.title)}">`
    + carga
    + `<title>${escaparXml(input.title)}</title>`
    + `<circle cx="200" cy="200" r="190" fill="${c.borde}"/>`
    + `<circle cx="200" cy="200" r="172" fill="${c.fondo}"/>`
    + `<circle cx="200" cy="200" r="150" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="6 7"/>`
    + `<text x="200" y="98" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#ffffff" fill-opacity="0.85">${escaparXml(ETIQUETA[input.sourceType])}</text>`
    + texto
    + `<path d="M172 276 l18 18 l38 -40" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<text x="200" y="334" text-anchor="middle" font-family="Courier New, monospace" font-size="15" fill="#ffffff" fill-opacity="0.9">${escaparXml(input.code)}</text>`
    + `<text x="200" y="356" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#ffffff" fill-opacity="0.7">Afinia · verificable</text>`
    + `</svg>`;
}

/** Distancia de un punto a un segmento, para dibujar el trazo del visto. */
function distanciaASegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** PNG de la insignia (sin texto: el PNG no tiene tipografías), horneado con la credencial. */
export function bakedBadgePng(sourceType: CredentialSourceType, credentialJson: string): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { PNG } = require('pngjs');
  const lado = 256;
  const png = new PNG({ width: lado, height: lado });
  const [r, g, b] = COLORES[sourceType].rgb;
  const centro = lado / 2;
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const i = (y * lado + x) * 4;
      const d = Math.hypot(x + 0.5 - centro, y + 0.5 - centro);
      let color: [number, number, number] = [r, g, b];
      let alfa = Math.max(0, Math.min(1, 122 - d));
      if (d > 112) color = [Math.round(r * 0.7), Math.round(g * 0.7), Math.round(b * 0.7)];
      if (Math.abs(d - 98) < 1.5) color = [255, 255, 255];
      const trazo = Math.min(
        distanciaASegmento(x, y, 88, 132, 114, 158),
        distanciaASegmento(x, y, 114, 158, 170, 100),
      );
      if (trazo < 9) color = [255, 255, 255];
      if (d > 122) alfa = 0;
      png.data[i] = color[0];
      png.data[i + 1] = color[1];
      png.data[i + 2] = color[2];
      png.data[i + 3] = Math.round(alfa * 255);
    }
  }
  const base: Buffer = PNG.sync.write(png);
  return insertarITxt(base, 'openbadgecredential', credentialJson);
}

/** Inserta un bloque iTXt sin comprimir justo antes de IEND. */
export function insertarITxt(png: Buffer, clave: string, texto: string): Buffer {
  const datos = Buffer.concat([
    Buffer.from(clave, 'latin1'), Buffer.from([0]), // clave
    Buffer.from([0, 0]), // sin compresión, método 0
    Buffer.from([0]), // idioma vacío
    Buffer.from([0]), // clave traducida vacía
    Buffer.from(texto, 'utf8'),
  ]);
  const tipo = Buffer.from('iTXt', 'latin1');
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tipo, datos])));
  const iend = png.length - 12;
  if (png.toString('latin1', iend + 4, iend + 8) !== 'IEND') throw new Error('PNG sin IEND al final.');
  return Buffer.concat([png.subarray(0, iend), largo, tipo, datos, crc, png.subarray(iend)]);
}

/**
 * La credencial horneada en una imagen: PNG (iTXt `openbadgecredential` u
 * `openbadges`) o SVG (`<openbadges:credential>` o `<openbadges:assertion>`).
 * Devuelve el texto (JSON, JWT o URL) o `null`.
 */
export function readBakedCredential(buffer: Buffer): string | null {
  const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 16 && buffer.subarray(0, 8).equals(FIRMA)) {
    let off = 8;
    for (let n = 0; n < 4000 && off + 12 <= buffer.length; n += 1) {
      const largo = buffer.readUInt32BE(off);
      const tipo = buffer.toString('latin1', off + 4, off + 8);
      const inicio = off + 8;
      const fin = inicio + largo;
      if (fin + 4 > buffer.length) return null;
      if (tipo === 'iTXt' || tipo === 'tEXt') {
        const datos = buffer.subarray(inicio, fin);
        const cero = datos.indexOf(0);
        const clave = datos.toString('latin1', 0, cero);
        if (clave === 'openbadgecredential' || clave === 'openbadges') {
          if (tipo === 'tEXt') return datos.toString('latin1', cero + 1).trim();
          if (datos[cero + 1] === 1) return null; // comprimido: no se admite
          let p = cero + 3;
          p = datos.indexOf(0, p) + 1;
          p = datos.indexOf(0, p) + 1;
          return datos.toString('utf8', p).trim();
        }
      }
      if (tipo === 'IEND') break;
      off = fin + 4;
    }
    return null;
  }
  const inicio = buffer.subarray(0, 512).toString('utf8');
  if (/<svg[\s>]/i.test(inicio) || /^\s*<\?xml/i.test(inicio)) {
    const svg = buffer.toString('utf8');
    const m = /<openbadges:(?:credential|assertion)[^>]*?(?:verify="([^"]+)")?[^>]*>([\s\S]*?)<\/openbadges:(?:credential|assertion)>/i.exec(svg);
    if (!m) return null;
    if (m[1]) return m[1];
    const cuerpo = m[2].replace(/<!\[CDATA\[/g, '').replace(/]]>/g, '').trim();
    return cuerpo || null;
  }
  return null;
}
