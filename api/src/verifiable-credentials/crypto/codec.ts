/**
 * Codificaciones que piden los estándares de credenciales verificables.
 *
 * - base58btc (multibase «z»): las claves Multikey y los `proofValue` de
 *   Data Integrity (W3C VC Data Integrity 1.0).
 * - base64url sin relleno (multibase «u»): JWS y listas de estado.
 * - CRC-32: los bloques de un PNG «horneado» (Open Badges Baking).
 *
 * Escritas aquí, sin dependencias: son pocas líneas, tienen vectores de
 * prueba conocidos y así no hay un paquete más que auditar.
 */

const ALFABETO_58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDICE_58 = new Map([...ALFABETO_58].map((c, i) => [c, i]));

export function base58btcEncode(bytes: Uint8Array): string {
  let ceros = 0;
  while (ceros < bytes.length && bytes[ceros] === 0) ceros += 1;
  // Conversión de base 256 a base 58, dígito a dígito.
  const digitos: number[] = [];
  for (let i = ceros; i < bytes.length; i += 1) {
    let acarreo = bytes[i];
    for (let j = 0; j < digitos.length; j += 1) {
      acarreo += digitos[j] << 8;
      digitos[j] = acarreo % 58;
      acarreo = Math.floor(acarreo / 58);
    }
    while (acarreo > 0) {
      digitos.push(acarreo % 58);
      acarreo = Math.floor(acarreo / 58);
    }
  }
  let salida = '1'.repeat(ceros);
  for (let i = digitos.length - 1; i >= 0; i -= 1) salida += ALFABETO_58[digitos[i]];
  return salida;
}

export function base58btcDecode(texto: string): Uint8Array {
  if (texto.length > 4096) throw new Error('Texto base58 demasiado largo.');
  let ceros = 0;
  while (ceros < texto.length && texto[ceros] === '1') ceros += 1;
  const bytes: number[] = [];
  for (let i = ceros; i < texto.length; i += 1) {
    const valor = INDICE_58.get(texto[i]);
    if (valor === undefined) throw new Error('Carácter inválido en base58.');
    let acarreo = valor;
    for (let j = 0; j < bytes.length; j += 1) {
      acarreo += bytes[j] * 58;
      bytes[j] = acarreo & 0xff;
      acarreo >>= 8;
    }
    while (acarreo > 0) {
      bytes.push(acarreo & 0xff);
      acarreo >>= 8;
    }
  }
  const salida = new Uint8Array(ceros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) salida[ceros + i] = bytes[bytes.length - 1 - i];
  return salida;
}

export const base64urlEncode = (bytes: Uint8Array | Buffer | string): string =>
  Buffer.from(typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes).toString('base64url');

export function base64urlDecode(texto: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(texto)) throw new Error('Texto base64url inválido.');
  return Buffer.from(texto, 'base64url');
}

/** Multibase: el primer carácter dice la base. Solo las dos que usa el sistema. */
export function multibaseDecode(texto: string): Uint8Array {
  if (texto.startsWith('z')) return base58btcDecode(texto.slice(1));
  if (texto.startsWith('u')) return new Uint8Array(base64urlDecode(texto.slice(1)));
  throw new Error('Codificación multibase no soportada.');
}

let TABLA_CRC: Uint32Array | null = null;

export function crc32(datos: Uint8Array): number {
  if (!TABLA_CRC) {
    TABLA_CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLA_CRC[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of datos) crc = TABLA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
