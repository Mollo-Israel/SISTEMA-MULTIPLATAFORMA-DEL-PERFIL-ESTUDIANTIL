import { KeyObject, constants, createHash, createPrivateKey, createPublicKey, hkdfSync, sign, verify } from 'node:crypto';
import { base58btcDecode, base58btcEncode, base64urlDecode, base64urlEncode } from './codec';

/**
 * Claves Ed25519 y su representación en los formatos de los estándares.
 *
 * Ed25519 es la curva de `eddsa-jcs-2022` (Data Integrity) y de `EdDSA` en
 * JOSE. Node la trae de serie: no hace falta ninguna librería criptográfica.
 */

// Prefijos DER fijos de Ed25519 (RFC 8410): con ellos una semilla de 32 bytes
// se convierte en una clave PKCS#8 y 32 bytes públicos en una SPKI.
const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');
/** Código multicodec de una clave pública Ed25519 (0xed como varint). */
const MULTICODEC_ED25519_PUB = Buffer.from([0xed, 0x01]);

export interface Ed25519KeyPair {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** Los 32 bytes de la clave pública. */
  publicRaw: Buffer;
}

export function ed25519FromSeed(seed: Uint8Array): Ed25519KeyPair {
  if (seed.length !== 32) throw new Error('La semilla Ed25519 debe tener 32 bytes.');
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(seed)]), format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey, publicRaw: ed25519PublicRaw(publicKey) };
}

export function ed25519PublicRaw(publicKey: KeyObject): Buffer {
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return Buffer.from(der.subarray(der.length - 32));
}

export function ed25519PublicFromRaw(raw: Uint8Array): KeyObject {
  if (raw.length !== 32) throw new Error('Una clave pública Ed25519 tiene 32 bytes.');
  return createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(raw)]), format: 'der', type: 'spki' });
}

/**
 * Semilla derivada de un secreto con HKDF-SHA256 (RFC 5869).
 *
 * Solo cuando no se configuró una clave propia: es estable mientras el
 * secreto no cambie, y si cambia, las claves públicas anteriores siguen
 * registradas, así que lo ya firmado se sigue verificando.
 */
export function deriveSeed(secreto: string, contexto: string): Buffer {
  return Buffer.from(hkdfSync('sha256', Buffer.from(secreto, 'utf8'), Buffer.from('afinia-credenciales', 'utf8'), Buffer.from(contexto, 'utf8'), 32));
}

/** Clave pública como Multikey (`publicKeyMultibase`): «z6Mk…». */
export const toMultikey = (publicRaw: Uint8Array): string =>
  `z${base58btcEncode(Buffer.concat([MULTICODEC_ED25519_PUB, Buffer.from(publicRaw)]))}`;

export function fromMultikey(multibase: string): Buffer {
  if (!multibase.startsWith('z')) throw new Error('Multikey no codificada en base58btc.');
  const bytes = Buffer.from(base58btcDecode(multibase.slice(1)));
  if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01) {
    throw new Error('La Multikey no es una clave pública Ed25519.');
  }
  return bytes.subarray(2);
}

/** `did:key` de una clave Ed25519 (W3C CCG did:key). */
export const toDidKey = (publicRaw: Uint8Array): string => `did:key:${toMultikey(publicRaw)}`;

export const toJwk = (publicRaw: Uint8Array) => ({ kty: 'OKP', crv: 'Ed25519', x: base64urlEncode(publicRaw) });

/** Huella corta y estable de una clave pública: su identificador. */
export const keyIdOf = (publicRaw: Uint8Array): string =>
  `key-${createHash('sha256').update(publicRaw).digest('base64url').slice(0, 16)}`;

export const ed25519Sign = (privateKey: KeyObject, datos: Uint8Array): Buffer => sign(null, datos, privateKey);

export function ed25519Verify(publicKey: KeyObject, datos: Uint8Array, firma: Uint8Array): boolean {
  try {
    return verify(null, datos, publicKey, firma);
  } catch {
    return false;
  }
}

/** Una clave pública JWK (OKP, EC o RSA) como KeyObject. */
export function publicKeyFromJwk(jwk: Record<string, unknown>): KeyObject {
  const limpio: Record<string, unknown> = {};
  // Nunca una clave privada: si trae `d`, se descarta.
  for (const k of ['kty', 'crv', 'x', 'y', 'n', 'e']) if (jwk[k] !== undefined) limpio[k] = jwk[k];
  return createPublicKey({ key: limpio as never, format: 'jwk' });
}

/** Algoritmos JWS admitidos y cómo se verifican (RFC 7518, RFC 8037). */
const ALGORITMOS: Record<string, { hash: string | null; tipo: 'ed' | 'ec' | 'rsa' | 'pss' }> = {
  EdDSA: { hash: null, tipo: 'ed' },
  Ed25519: { hash: null, tipo: 'ed' },
  ES256: { hash: 'sha256', tipo: 'ec' },
  ES384: { hash: 'sha384', tipo: 'ec' },
  RS256: { hash: 'sha256', tipo: 'rsa' },
  RS384: { hash: 'sha384', tipo: 'rsa' },
  RS512: { hash: 'sha512', tipo: 'rsa' },
  PS256: { hash: 'sha256', tipo: 'pss' },
};

export const ALGORITMOS_JWS = Object.keys(ALGORITMOS);

export function verifyWithAlg(alg: string, key: KeyObject, datos: Uint8Array, firma: Uint8Array): boolean {
  const a = ALGORITMOS[alg];
  if (!a) return false;
  try {
    if (a.tipo === 'ed') return key.asymmetricKeyType === 'ed25519' && verify(null, datos, key, firma);
    if (a.tipo === 'ec') return verify(a.hash, datos, { key, dsaEncoding: 'ieee-p1363' }, firma);
    if (a.tipo === 'pss') {
      return verify(a.hash, datos, { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST }, firma);
    }
    return verify(a.hash, datos, key, firma);
  } catch {
    return false;
  }
}

/** Semilla desde la variable de entorno: base64url o hex de 32 bytes. */
export function parseSeed(valor: string): Buffer {
  const v = valor.trim();
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, 'hex');
  const b = base64urlDecode(v.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'));
  if (b.length !== 32) throw new Error('CREDENTIALS_SIGNING_KEY debe ser una semilla de 32 bytes (hex o base64url).');
  return b;
}
