import { Injectable, Logger } from '@nestjs/common';
import { KeyObject, createPublicKey } from 'node:crypto';
import { LinkCheckerService } from '../validation/link-checker.service';
import { LinkCheckStatus } from '@perfil/shared';
import { base64urlDecode } from './crypto/codec';
import { ProofCheck, proofOf, verifyProof } from './crypto/data-integrity';
import { decodeJws, pareceJws, verifyJws } from './crypto/jws';
import { ed25519PublicFromRaw, fromMultikey, publicKeyFromJwk } from './crypto/keys';

export type ProofFormat = 'data_integrity' | 'vc_jwt' | 'ob2_signed' | 'none';

export interface ProofResult {
  format: ProofFormat;
  /** `true` firma válida; `false` firma inválida; `null` no se pudo evaluar. */
  verified: boolean | null;
  reason: string;
  verificationMethod: string | null;
  issuerId: string | null;
  /** ¿La clave pertenece al emisor que dice la credencial? */
  issuerBound: boolean | null;
  /** La credencial (para un JWT, su contenido decodificado). */
  credential: Record<string, unknown> | null;
  /** ¿La firmó Afinia? */
  local: boolean;
}

interface ClaveResuelta {
  key: KeyObject;
  controller: string | null;
  local: boolean;
}

/** Resolver de claves propias: lo registra el módulo de credenciales. */
export type LocalKeyResolver = (verificationMethod: string) => Promise<{ key: KeyObject; controller: string } | null>;

const sinFragmento = (u: string) => u.split('#')[0];
const fragmento = (u: string) => (u.includes('#') ? u.slice(u.indexOf('#') + 1) : null);

function emisorDe(doc: Record<string, unknown>): string | null {
  const i = doc.issuer;
  if (typeof i === 'string') return i;
  if (i && typeof i === 'object' && typeof (i as { id?: unknown }).id === 'string') return (i as { id: string }).id;
  return null;
}

/** ¿El método de verificación es del emisor? Mismo DID/URL base o controlador declarado. */
function vinculadoAlEmisor(emisor: string | null, vm: string | null, controller: string | null): boolean | null {
  if (!emisor || !vm) return null;
  const base = sinFragmento(vm);
  if (base === emisor || sinFragmento(emisor) === base) return true;
  if (controller && (controller === emisor || sinFragmento(controller) === sinFragmento(emisor))) return true;
  return false;
}

/**
 * Verificador de pruebas criptográficas de credenciales (V8).
 *
 * Admite:
 * - Data Integrity `eddsa-jcs-2022` (Open Badges 3.0 / VC 2.0);
 * - VC-JWT (JWS compacto con EdDSA, ES256/384, RS256/384/512 o PS256);
 * - aserciones firmadas de Open Badges 2.0 (JWS con `verification.creator`).
 *
 * Las claves se resuelven desde `did:key`, `did:jwk`, `did:web` o una URL
 * https, siempre con la protección SSRF del verificador de enlaces. Lo que
 * no puede evaluar (por ejemplo `eddsa-rdfc-2022`, que exige canonizar RDF)
 * lo dice como «no evaluable», nunca como válido ni como falso.
 */
@Injectable()
export class ProofVerifierService {
  private readonly logger = new Logger(ProofVerifierService.name);
  private localResolver: LocalKeyResolver | null = null;

  constructor(private readonly links: LinkCheckerService) {}

  registerLocalResolver(resolver: LocalKeyResolver): void {
    this.localResolver = resolver;
  }

  /** Entrada: un objeto JSON, un texto JSON o un JWS compacto. */
  async verify(entrada: unknown): Promise<ProofResult> {
    const base: ProofResult = {
      format: 'none', verified: null, reason: '', verificationMethod: null, issuerId: null, issuerBound: null, credential: null, local: false,
    };
    let valor = entrada;
    if (typeof valor === 'string') {
      const t = valor.trim();
      if (pareceJws(t)) return this.verifyJwt(t);
      try {
        valor = JSON.parse(t);
      } catch {
        return { ...base, reason: 'No es JSON ni un JWT.' };
      }
    }
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return { ...base, reason: 'La credencial debe ser un objeto JSON.' };
    const doc = valor as Record<string, unknown>;
    if (!doc.proof) {
      return { ...base, credential: doc, issuerId: emisorDe(doc), reason: 'La credencial no trae prueba criptográfica.' };
    }
    return this.verifyDataIntegrity(doc);
  }

  private async verifyDataIntegrity(doc: Record<string, unknown>): Promise<ProofResult> {
    const issuerId = emisorDe(doc);
    const r: ProofResult = {
      format: 'data_integrity', verified: null, reason: '', verificationMethod: null, issuerId, issuerBound: null, credential: doc, local: false,
    };
    const proof = proofOf(doc);
    if (typeof proof === 'string') return { ...r, verified: false, reason: proof };
    r.verificationMethod = proof.verificationMethod;
    if (proof.cryptosuite !== 'eddsa-jcs-2022') {
      return { ...r, reason: `Conjunto «${String(proof.cryptosuite)}» no evaluable aquí: requiere canonización RDF. No se afirma ni se niega.` };
    }
    const clave = await this.resolveKey(proof.verificationMethod);
    if ('error' in clave) return { ...r, reason: clave.error };
    const check: ProofCheck = verifyProof(doc, clave.key);
    const issuerBound = vinculadoAlEmisor(issuerId, proof.verificationMethod, clave.controller);
    if (!check.ok) return { ...r, verified: false, reason: check.reason, issuerBound, local: clave.local };
    if (issuerBound === false) {
      return { ...r, verified: false, issuerBound, local: clave.local, reason: 'La firma es válida, pero la clave no pertenece al emisor que dice la credencial.' };
    }
    return { ...r, verified: true, issuerBound, local: clave.local, reason: 'Firma Data Integrity válida (eddsa-jcs-2022).' };
  }

  private async verifyJwt(token: string): Promise<ProofResult> {
    const r: ProofResult = {
      format: 'vc_jwt', verified: null, reason: '', verificationMethod: null, issuerId: null, issuerBound: null, credential: null, local: false,
    };
    let dec: ReturnType<typeof decodeJws>;
    try {
      dec = decodeJws(token);
    } catch (e) {
      return { ...r, verified: false, reason: `JWT ilegible: ${(e as Error).message}` };
    }
    const p = dec.payload;
    // Aserción firmada de Open Badges 2.0.
    if (p.type === 'Assertion' || (typeof p['@context'] === 'string' && String(p['@context']).includes('openbadges'))) {
      return this.verifyOb2Signed(dec);
    }
    const credencial = (p.vc && typeof p.vc === 'object' ? p.vc : p) as Record<string, unknown>;
    const issuerId = emisorDe(credencial) ?? (typeof p.iss === 'string' ? p.iss : null);
    r.credential = credencial;
    r.issuerId = issuerId;
    let kid = typeof dec.header.kid === 'string' ? dec.header.kid : null;
    if (kid?.startsWith('#') && issuerId) kid = `${issuerId}${kid}`;
    if (!kid && issuerId?.startsWith('did:')) kid = issuerId;
    if (!kid) return { ...r, reason: 'El JWT no dice con qué clave se firmó (kid).' };
    r.verificationMethod = kid;
    const clave = await this.resolveKey(kid);
    if ('error' in clave) return { ...r, reason: clave.error };
    const ok = verifyJws(dec, clave.key);
    const issuerBound = vinculadoAlEmisor(issuerId, kid, clave.controller);
    if (!ok) return { ...r, verified: false, issuerBound, local: clave.local, reason: 'La firma del JWT no corresponde a su contenido o a la clave.' };
    if (typeof p.exp === 'number' && p.exp * 1000 < Date.now()) {
      return { ...r, verified: false, issuerBound, local: clave.local, reason: 'El JWT está vencido (exp).' };
    }
    if (issuerBound === false) {
      return { ...r, verified: false, issuerBound, local: clave.local, reason: 'La firma es válida, pero la clave no pertenece al emisor.' };
    }
    return { ...r, verified: true, issuerBound, local: clave.local, reason: `Firma JWT válida (${String(dec.header.alg)}).` };
  }

  /** Open Badges 2.0 firmada: la clave pública está en `verification.creator`. */
  private async verifyOb2Signed(dec: ReturnType<typeof decodeJws>): Promise<ProofResult> {
    const p = dec.payload;
    const verificacion = (p.verification ?? {}) as Record<string, unknown>;
    const creador = typeof verificacion.creator === 'string' ? verificacion.creator : null;
    const r: ProofResult = {
      format: 'ob2_signed', verified: null, reason: '', verificationMethod: creador, issuerId: null, issuerBound: null, credential: p, local: false,
    };
    if (!creador) return { ...r, reason: 'La aserción firmada no dice dónde está su clave (verification.creator).' };
    const doc = await this.fetchJson(creador);
    if ('error' in doc) return { ...r, reason: doc.error };
    const pem = typeof doc.json.publicKeyPem === 'string' ? doc.json.publicKeyPem : null;
    if (!pem) return { ...r, reason: 'El documento de la clave no trae publicKeyPem.' };
    let key: KeyObject;
    try {
      key = createPublicKey(pem);
    } catch {
      return { ...r, verified: false, reason: 'La clave publicada no es una clave pública válida.' };
    }
    const ok = verifyJws(dec, key);
    return ok
      ? { ...r, verified: true, issuerId: typeof doc.json.owner === 'string' ? doc.json.owner : null, reason: `Aserción OB 2.0 firmada válida (${String(dec.header.alg)}).` }
      : { ...r, verified: false, reason: 'La firma de la aserción no corresponde a la clave publicada.' };
  }

  /** Una clave pública a partir de un método de verificación. */
  async resolveKey(vm: string): Promise<ClaveResuelta | { error: string }> {
    if (typeof vm !== 'string' || vm.length > 2048) return { error: 'Método de verificación inválido.' };
    try {
      if (this.localResolver) {
        const local = await this.localResolver(vm);
        if (local) return { key: local.key, controller: local.controller, local: true };
      }
      if (vm.startsWith('did:key:')) {
        const id = sinFragmento(vm).slice('did:key:'.length);
        const frag = fragmento(vm);
        if (frag && frag !== id) return { error: 'El fragmento de did:key no coincide con la clave.' };
        return { key: ed25519PublicFromRaw(fromMultikey(id)), controller: sinFragmento(vm), local: false };
      }
      if (vm.startsWith('did:jwk:')) {
        const jwk = JSON.parse(base64urlDecode(sinFragmento(vm).slice('did:jwk:'.length)).toString('utf8'));
        return { key: publicKeyFromJwk(jwk), controller: sinFragmento(vm), local: false };
      }
      if (vm.startsWith('did:web:')) return this.resolverDidWeb(vm);
      if (/^https:\/\//i.test(vm) || this.links.esOrigenDePrueba(vm)) return this.resolverUrl(vm);
      return { error: `No se sabe resolver la clave «${vm.slice(0, 80)}»: se admiten did:key, did:jwk, did:web y https.` };
    } catch (e) {
      return { error: `La clave no se pudo leer: ${(e as Error).message}` };
    }
  }

  private async resolverDidWeb(vm: string): Promise<ClaveResuelta | { error: string }> {
    const did = sinFragmento(vm);
    const partes = did.slice('did:web:'.length).split(':').map(decodeURIComponent);
    if (!partes[0] || /[/?#@]/.test(partes[0])) return { error: 'did:web con dominio inválido.' };
    const url = partes.length === 1
      ? `https://${partes[0]}/.well-known/did.json`
      : `https://${partes[0]}/${partes.slice(1).join('/')}/did.json`;
    const doc = await this.fetchJson(url);
    if ('error' in doc) return doc;
    return this.claveDeDocumento(doc.json, vm, did);
  }

  private async resolverUrl(vm: string): Promise<ClaveResuelta | { error: string }> {
    const doc = await this.fetchJson(sinFragmento(vm));
    if ('error' in doc) return doc;
    return this.claveDeDocumento(doc.json, vm, typeof doc.json.id === 'string' ? sinFragmento(doc.json.id) : sinFragmento(vm));
  }

  /** Busca la clave en un documento: DID/perfil con `verificationMethod`, JWKS o la clave misma. */
  private claveDeDocumento(json: Record<string, unknown>, vm: string, controladorPorDefecto: string): ClaveResuelta | { error: string } {
    const frag = fragmento(vm);
    const candidatos: Record<string, unknown>[] = [];
    if (Array.isArray(json.verificationMethod)) candidatos.push(...(json.verificationMethod as Record<string, unknown>[]));
    if (Array.isArray(json.keys)) candidatos.push(...(json.keys as Record<string, unknown>[]));
    candidatos.push(json);
    const elegido = candidatos.find((c) => c && typeof c === 'object' && (
      c.id === vm || (frag && (c.id === `#${frag}` || c.kid === frag || String(c.id ?? '').endsWith(`#${frag}`)))
    ));
    if (!elegido) return { error: 'El documento publicado no contiene la clave indicada.' };
    const controller = typeof elegido.controller === 'string' ? elegido.controller : controladorPorDefecto;
    if (typeof elegido.publicKeyMultibase === 'string') {
      return { key: ed25519PublicFromRaw(fromMultikey(elegido.publicKeyMultibase)), controller, local: false };
    }
    const jwk = (elegido.publicKeyJwk ?? (elegido.kty ? elegido : null)) as Record<string, unknown> | null;
    if (jwk) return { key: publicKeyFromJwk(jwk), controller, local: false };
    if (typeof elegido.publicKeyPem === 'string') return { key: createPublicKey(elegido.publicKeyPem), controller, local: false };
    return { error: 'La clave publicada no está en un formato admitido (Multikey, JWK o PEM).' };
  }

  private async fetchJson(url: string): Promise<{ json: Record<string, unknown> } | { error: string }> {
    const r = await this.links.fetchPage(url);
    if (r.result.status !== LinkCheckStatus.AVAILABLE || !r.body) {
      return { error: `No se pudo consultar la clave publicada (${r.result.status}).` };
    }
    try {
      const json = JSON.parse(r.body);
      if (!json || typeof json !== 'object') return { error: 'El documento de la clave no es un objeto JSON.' };
      return { json };
    } catch {
      this.logger.debug(`Documento de clave no JSON en ${url}`);
      return { error: 'El documento de la clave no es JSON.' };
    }
  }
}
