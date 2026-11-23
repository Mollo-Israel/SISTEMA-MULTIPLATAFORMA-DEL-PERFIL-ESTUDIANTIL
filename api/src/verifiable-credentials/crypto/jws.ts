import { KeyObject } from 'node:crypto';
import { base64urlDecode, base64urlEncode } from './codec';
import { ed25519Sign, verifyWithAlg } from './keys';

/**
 * JWS compacto (RFC 7515): `cabecera.carga.firma`, todo en base64url.
 *
 * Es el formato VC-JWT que admite Open Badges 3.0 (§8.2) y el de las
 * aserciones firmadas de Open Badges 2.0.
 */

export const pareceJws = (texto: string): boolean =>
  /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}$/.test(texto.trim());

export function signJwsEdDSA(header: Record<string, unknown>, payload: unknown, privateKey: KeyObject): string {
  const h = base64urlEncode(JSON.stringify({ ...header, alg: 'EdDSA' }));
  const p = base64urlEncode(JSON.stringify(payload));
  const firma = ed25519Sign(privateKey, Buffer.from(`${h}.${p}`, 'ascii'));
  return `${h}.${p}.${base64urlEncode(firma)}`;
}

export interface JwsDecoded {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: Buffer;
  signature: Buffer;
}

export function decodeJws(token: string): JwsDecoded {
  const partes = token.trim().split('.');
  if (partes.length !== 3) throw new Error('Un JWS compacto tiene tres partes.');
  const header = JSON.parse(base64urlDecode(partes[0]).toString('utf8'));
  const payload = JSON.parse(base64urlDecode(partes[1]).toString('utf8'));
  if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') {
    throw new Error('La cabecera y la carga de un JWS deben ser objetos JSON.');
  }
  return {
    header,
    payload,
    signingInput: Buffer.from(`${partes[0]}.${partes[1]}`, 'ascii'),
    signature: base64urlDecode(partes[2]),
  };
}

export function verifyJws(decoded: JwsDecoded, key: KeyObject): boolean {
  const alg = String(decoded.header.alg ?? '');
  // «none» y los HMAC no prueban quién firmó: se rechazan siempre.
  if (!alg || alg === 'none' || alg.startsWith('HS')) return false;
  return verifyWithAlg(alg, key, decoded.signingInput, decoded.signature);
}
