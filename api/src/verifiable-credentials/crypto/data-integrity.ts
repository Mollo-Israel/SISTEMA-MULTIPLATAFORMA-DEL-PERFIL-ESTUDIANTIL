import { createHash, KeyObject } from 'node:crypto';
import { canonicalize } from './jcs';
import { base58btcDecode, base58btcEncode } from './codec';
import { ed25519Sign, ed25519Verify } from './keys';

/**
 * Prueba Data Integrity con el conjunto `eddsa-jcs-2022`
 * (W3C Data Integrity EdDSA Cryptosuites v1.0, §3.3).
 *
 * 1. El documento sin `proof` se canoniza con JCS.
 * 2. La configuración de la prueba (sin `proofValue`) se canoniza con JCS,
 *    llevando el `@context` del documento.
 * 3. Se firma SHA-256(configuración) ‖ SHA-256(documento) con Ed25519.
 * 4. `proofValue` = multibase base58btc de la firma.
 *
 * Cualquier cambio en un solo carácter del documento, en la fecha de la
 * prueba o en la clave que dice usar invalida la firma.
 */

export const CRYPTOSUITE = 'eddsa-jcs-2022';

export interface DataIntegrityProof {
  type: 'DataIntegrityProof';
  cryptosuite: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
  [k: string]: unknown;
}

const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest();

function sinPrueba(documento: Record<string, unknown>): Record<string, unknown> {
  const { proof: _proof, ...resto } = documento;
  return resto;
}

function datosAFirmar(documento: Record<string, unknown>, opciones: Record<string, unknown>): Buffer {
  const config: Record<string, unknown> = { ...opciones };
  delete config.proofValue;
  if (documento['@context'] !== undefined) config['@context'] = documento['@context'];
  return Buffer.concat([sha256(canonicalize(config)), sha256(canonicalize(documento))]);
}

export function createProof(
  documento: Record<string, unknown>,
  privateKey: KeyObject,
  opciones: { verificationMethod: string; created: string; proofPurpose?: string },
): Record<string, unknown> {
  const sinFirma = sinPrueba(documento);
  const config = {
    type: 'DataIntegrityProof',
    cryptosuite: CRYPTOSUITE,
    created: opciones.created,
    verificationMethod: opciones.verificationMethod,
    proofPurpose: opciones.proofPurpose ?? 'assertionMethod',
  };
  const firma = ed25519Sign(privateKey, datosAFirmar(sinFirma, config));
  return { ...sinFirma, proof: { ...config, proofValue: `z${base58btcEncode(firma)}` } };
}

export type ProofCheck =
  | { ok: true; verificationMethod: string; created: string | null }
  | { ok: false; reason: string; verificationMethod: string | null };

/** La prueba única del documento, o el motivo por el que no se puede evaluar. */
export function proofOf(documento: Record<string, unknown>): DataIntegrityProof | string {
  const p = documento.proof;
  if (!p) return 'El documento no trae una prueba criptográfica.';
  if (Array.isArray(p)) return 'El documento trae varias pruebas: se admite una sola.';
  if (typeof p !== 'object') return 'La prueba no tiene la forma esperada.';
  const proof = p as DataIntegrityProof;
  if (proof.type !== 'DataIntegrityProof') return `Tipo de prueba no soportado: ${String(proof.type)}.`;
  if (typeof proof.verificationMethod !== 'string') return 'La prueba no dice con qué clave se firmó.';
  if (typeof proof.proofValue !== 'string') return 'La prueba no trae la firma.';
  return proof;
}

/**
 * Verifica una prueba `eddsa-jcs-2022` con la clave pública dada.
 * Quien llama resuelve antes la clave a partir de `verificationMethod`.
 */
export function verifyProof(documento: Record<string, unknown>, publicKey: KeyObject): ProofCheck {
  const proof = proofOf(documento);
  if (typeof proof === 'string') return { ok: false, reason: proof, verificationMethod: null };
  if (proof.cryptosuite !== CRYPTOSUITE) {
    return { ok: false, reason: `Conjunto criptográfico no soportado: ${String(proof.cryptosuite)}.`, verificationMethod: proof.verificationMethod };
  }
  if (proof.proofPurpose !== 'assertionMethod') {
    return { ok: false, reason: 'La prueba no es de emisión (assertionMethod).', verificationMethod: proof.verificationMethod };
  }
  let firma: Uint8Array;
  try {
    if (!proof.proofValue.startsWith('z')) throw new Error('multibase');
    firma = base58btcDecode(proof.proofValue.slice(1));
  } catch {
    return { ok: false, reason: 'La firma no está codificada en base58btc.', verificationMethod: proof.verificationMethod };
  }
  let ok: boolean;
  try {
    ok = ed25519Verify(publicKey, datosAFirmar(sinPrueba(documento), proof), firma);
  } catch (e) {
    return { ok: false, reason: `El documento no se puede canonizar: ${(e as Error).message}`, verificationMethod: proof.verificationMethod };
  }
  return ok
    ? { ok: true, verificationMethod: proof.verificationMethod, created: typeof proof.created === 'string' ? proof.created : null }
    : { ok: false, reason: 'La firma no corresponde al contenido: el documento fue alterado o no lo firmó esa clave.', verificationMethod: proof.verificationMethod };
}
