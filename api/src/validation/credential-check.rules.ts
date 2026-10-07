import { createHash } from 'node:crypto';
import {
  BackingTier,
  CredentialCheckStatus,
  IdentityMatchStatus,
  LinkCheckStatus,
} from '@perfil/shared';

/**
 * Reglas puras de la validación escalonada de credenciales externas (V3 §18–§20).
 *
 * Todo lo que decide un nivel de respaldo vive aquí, sin red ni base de
 * datos, para que pueda probarse y leerse de un vistazo. El servicio solo
 * reúne las señales y llama a estas funciones.
 *
 * La regla de confianza (§20) se cumple así:
 *   - con una fuente oficial verificable, se comprueba de forma determinista;
 *   - con solo archivo u OCR, el respaldo es parcial (SUPPORTED como mucho);
 *   - si no se puede concluir, no se inventa una conclusión (INCONCLUSIVE).
 */

// ===========================================================================
//  Dominios oficiales
// ===========================================================================

/** Plataformas de credenciales digitales que emiten en nombre de terceros. */
export const BADGE_PLATFORM_DOMAINS = [
  'credly.com', 'youracclaim.com', 'accredible.com', 'credential.net',
  'badgr.com', 'badgr.io', 'openbadgefactory.com', 'parchment.com',
] as const;

/**
 * Emisores conocidos y sus dominios de verificación.
 *
 * La clave se busca como palabra dentro del emisor declarado («Cisco
 * Networking Academy» → cisco). Sirve para las credenciales históricas, que
 * no traen dominios esperados de una oportunidad. Es un catálogo inicial,
 * no una promesa de universalidad (§20): un emisor que no está aquí no
 * puede corroborarse por dominio, y se dice.
 */
export const KNOWN_ISSUER_DOMAINS: Record<string, readonly string[]> = {
  cisco: ['netacad.com', 'cisco.com'],
  netacad: ['netacad.com', 'cisco.com'],
  ibm: ['ibm.com'],
  coursera: ['coursera.org'],
  edx: ['edx.org'],
  google: ['google.com', 'grow.google', 'coursera.org'],
  microsoft: ['microsoft.com'],
  amazon: ['amazon.com', 'aws.amazon.com', 'amazonaws.com'],
  aws: ['amazon.com', 'aws.amazon.com', 'amazonaws.com'],
  oracle: ['oracle.com'],
  linkedin: ['linkedin.com'],
  udemy: ['udemy.com', 'ude.my'],
  platzi: ['platzi.com'],
  freecodecamp: ['freecodecamp.org'],
  hackerrank: ['hackerrank.com'],
  datacamp: ['datacamp.com'],
  comptia: ['comptia.org'],
  scrum: ['scrum.org'],
  linux: ['linuxfoundation.org', 'lpi.org'],
  lpi: ['lpi.org'],
  unity: ['unity.com'],
  salesforce: ['salesforce.com', 'trailhead.com'],
  meta: ['meta.com', 'coursera.org'],
  huawei: ['huawei.com'],
  fortinet: ['fortinet.com'],
};

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** `host` es `dominio` o un subdominio suyo. Nunca por subcadena: `evilcredly.com` no es `credly.com`. */
export function hostMatches(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  const d = domain.toLowerCase().replace(/^\.+|\.$/g, '');
  return !!d && (h === d || h.endsWith(`.${d}`));
}

/**
 * Dominios oficiales contra los que se juzga una URL de verificación.
 *
 * Devuelve `null` cuando no hay base para juzgar: emisor desconocido y sin
 * dominios esperados. En ese caso una URL que responde no corrobora nada,
 * porque cualquiera puede publicar una página con el texto que quiera.
 */
export function officialDomainsFor(issuer: string | null, expected: readonly string[] = []): string[] | null {
  const propios = new Set(expected.map((d) => d.toLowerCase().trim()).filter(Boolean));
  const palabras = new Set(normalizar(issuer ?? '').split(/[^a-z0-9]+/).filter(Boolean));
  let conocido = false;
  for (const [clave, dominios] of Object.entries(KNOWN_ISSUER_DOMAINS)) {
    if (palabras.has(clave)) {
      conocido = true;
      dominios.forEach((d) => propios.add(d));
    }
  }
  if (!conocido && propios.size === 0) return null;
  // Las plataformas de insignias emiten por cuenta de emisores reales.
  BADGE_PLATFORM_DOMAINS.forEach((d) => propios.add(d));
  return [...propios];
}

/** ¿La URL apunta a un dominio oficial? `null` si no hay base para decirlo. */
export function isOfficialUrl(url: string | null, official: string[] | null): boolean | null {
  if (!url || !official) return null;
  try {
    const host = new URL(url).hostname;
    return official.some((d) => hostMatches(host, d));
  } catch {
    return false;
  }
}

// ===========================================================================
//  Página de verificación
// ===========================================================================

/** Texto visible de una página HTML: sin scripts, estilos ni etiquetas. */
export function htmlToText(html: string): string {
  const metas = [...html.matchAll(/<meta[^>]+content=["']([^"']{1,500})["'][^>]*>/gi)].map((m) => m[1]);
  const cuerpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
  return `${metas.join(' ')} ${cuerpo}`.replace(/\s+/g, ' ').trim().slice(0, 200_000);
}

const tokens = (s: string, min = 3) =>
  new Set(normalizar(s).split(/[^a-z0-9]+/).filter((t) => t.length >= min));

/** ¿Aparecen en el texto la mayoría de las palabras significativas de `frase`? */
export function phraseFound(text: string, frase: string | null | undefined, umbral = 0.6): boolean {
  if (!frase) return false;
  const buscadas = [...tokens(frase, 3)];
  if (!buscadas.length) return false;
  const presentes = tokens(text, 3);
  const halladas = buscadas.filter((t) => presentes.has(t)).length;
  return halladas / buscadas.length >= umbral;
}

/** ¿Aparece el código de credencial, tal cual (sin distinguir mayúsculas)? */
export function credentialIdFound(text: string, id: string | null | undefined): boolean {
  if (!id || id.trim().length < 4) return false;
  return normalizar(text).includes(normalizar(id.trim()));
}

/** El nombre del titular aparece completo (nombre y apellido). */
export function holderFound(text: string, holder: string): boolean {
  const partes = [...tokens(holder, 2)];
  if (partes.length < 2) return false;
  const presentes = tokens(text, 2);
  return partes.every((p) => presentes.has(p));
}

export interface PageComparison {
  credentialId: boolean;
  holder: boolean;
  course: boolean;
  issuer: boolean;
}

export function comparePage(
  text: string,
  ctx: { holderName: string; credentialId: string | null; course: string | null; issuer: string | null },
): PageComparison {
  return {
    credentialId: credentialIdFound(text, ctx.credentialId),
    holder: holderFound(text, ctx.holderName),
    course: phraseFound(text, ctx.course),
    issuer: phraseFound(text, ctx.issuer, 0.5),
  };
}

// ===========================================================================
//  Open Badges / credenciales verificables (§18.3)
// ===========================================================================

export interface OpenBadgeResult {
  format: 'open_badges_2' | 'verifiable_credential';
  /** El destinatario corresponde al estudiante. `null` si no pudo comprobarse. */
  recipientMatch: boolean | null;
  revoked: boolean;
  /** La aserción vive en la misma dirección que se consultó (verificación «hosted»). */
  hosted: boolean;
  /** Hay una prueba criptográfica declarada. */
  proofPresent: boolean;
  /** Se verificó la prueba criptográfica. */
  proofVerified: boolean;
  badgeName: string | null;
  issuerName: string | null;
}

const ctxIncluye = (ctx: unknown, needle: string) =>
  (Array.isArray(ctx) ? ctx : [ctx]).some((c) => typeof c === 'string' && c.includes(needle));

/**
 * Reconoce una aserción Open Badges 2.0 o una credencial verificable (OB 3.0).
 *
 * - OB 2.0 «hosted»: la aserción publicada por el emisor en su dominio ES la
 *   verificación. El destinatario se comprueba con el hash `sha256$…` y la
 *   sal que trae, contra los correos del estudiante.
 * - VC / OB 3.0: se valida la estructura, el sujeto y el estado; la prueba
 *   criptográfica se informa como presente, pero no se da por verificada
 *   (verificarla exige resolver claves del emisor y canonicalizar JSON-LD,
 *   fuera del alcance del MVP; se dice en lugar de simularlo).
 */
export function parseOpenBadge(
  json: unknown,
  ctx: { fetchedUrl: string | null; emails: string[]; holderName: string },
): OpenBadgeResult | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, any>;
  const contexto = o['@context'];

  const esOb2 = ctxIncluye(contexto, 'w3id.org/openbadges') && (o.type === 'Assertion' || (Array.isArray(o.type) && o.type.includes('Assertion')));
  const esVc = ctxIncluye(contexto, 'www.w3.org/2018/credentials') || ctxIncluye(contexto, 'www.w3.org/ns/credentials');
  if (!esOb2 && !esVc) return null;

  if (esOb2) {
    const r = o.recipient ?? {};
    let recipientMatch: boolean | null = null;
    if (typeof r.identity === 'string' && (r.type ?? 'email') === 'email') {
      if (r.hashed) {
        const [alg, hash] = String(r.identity).split('$');
        if (alg?.toLowerCase() === 'sha256' && hash) {
          recipientMatch = ctx.emails.some((e) =>
            createHash('sha256').update(`${e.toLowerCase()}${r.salt ?? ''}`).digest('hex') === hash.toLowerCase());
        }
      } else {
        recipientMatch = ctx.emails.some((e) => e.toLowerCase() === String(r.identity).toLowerCase());
      }
    }
    const verificacion = String(o.verification?.type ?? o.verify?.type ?? '').toLowerCase();
    const hosted = (verificacion === 'hosted' || verificacion === 'hostedbadge')
      && !!ctx.fetchedUrl && typeof o.id === 'string' && sameResource(o.id, ctx.fetchedUrl);
    const badge = typeof o.badge === 'object' ? o.badge : null;
    return {
      format: 'open_badges_2',
      recipientMatch,
      revoked: o.revoked === true,
      hosted,
      proofPresent: verificacion === 'signed' || verificacion === 'signedbadge',
      proofVerified: false,
      badgeName: badge?.name ?? null,
      issuerName: typeof badge?.issuer === 'object' ? badge.issuer?.name ?? null : null,
    };
  }

  const sujeto = Array.isArray(o.credentialSubject) ? o.credentialSubject[0] : o.credentialSubject;
  const nombreSujeto: string | null = sujeto?.name ?? null;
  const correoSujeto: string | null = sujeto?.email ?? sujeto?.identifier?.identityHash ?? null;
  let recipientMatch: boolean | null = null;
  if (correoSujeto && ctx.emails.length) {
    recipientMatch = ctx.emails.some((e) => e.toLowerCase() === String(correoSujeto).toLowerCase());
  } else if (nombreSujeto) {
    recipientMatch = holderFound(nombreSujeto, ctx.holderName);
  }
  const estado = o.credentialStatus?.statusPurpose === 'revocation' && o.credentialStatus?.revoked === true;
  return {
    format: 'verifiable_credential',
    recipientMatch,
    revoked: estado,
    hosted: false,
    proofPresent: !!o.proof,
    proofVerified: false,
    badgeName: sujeto?.achievement?.name ?? o.name ?? null,
    issuerName: typeof o.issuer === 'object' ? o.issuer?.name ?? null : (o.issuer ?? null),
  };
}

function sameResource(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.host === y.host && x.pathname.replace(/\/$/, '') === y.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}

/**
 * Busca una aserción Open Badges horneada en un PNG (§18.3).
 *
 * El estándar la guarda en un bloque `iTXt` (o `tEXt`) con la clave
 * `openbadges`: puede ser la aserción en JSON o la URL donde está publicada.
 */
export function readBakedBadge(png: Buffer): { json: unknown | null; url: string | null } | null {
  const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (png.length < 16 || !png.subarray(0, 8).equals(FIRMA)) return null;
  let off = 8;
  // Se recorren como mucho 2000 bloques: un PNG malformado no debe colgar nada.
  for (let n = 0; n < 2000 && off + 12 <= png.length; n += 1) {
    const largo = png.readUInt32BE(off);
    const tipo = png.toString('latin1', off + 4, off + 8);
    const inicio = off + 8;
    const fin = inicio + largo;
    if (fin + 4 > png.length) return null;
    if (tipo === 'iTXt' || tipo === 'tEXt') {
      const datos = png.subarray(inicio, fin);
      const cero = datos.indexOf(0);
      const clave = datos.toString('latin1', 0, cero);
      if (clave === 'openbadges') {
        let texto: string;
        if (tipo === 'tEXt') {
          texto = datos.toString('latin1', cero + 1);
        } else {
          // iTXt: clave\0 compresión(1) método(1) idioma\0 clave traducida\0 texto
          const comprimido = datos[cero + 1] === 1;
          if (comprimido) return null;
          let p = cero + 3;
          p = datos.indexOf(0, p) + 1;
          p = datos.indexOf(0, p) + 1;
          texto = datos.toString('utf8', p);
        }
        texto = texto.trim();
        if (/^https?:\/\//i.test(texto)) return { json: null, url: texto.slice(0, 500) };
        try {
          return { json: JSON.parse(texto), url: null };
        } catch {
          return null;
        }
      }
    }
    if (tipo === 'IEND') break;
    off = fin + 4;
  }
  return null;
}

// ===========================================================================
//  Decisiones
// ===========================================================================

export interface CredentialCheckInput {
  /** Resultado de consultar la URL/QR de verificación, si había alguna. */
  link: { status: LinkCheckStatus } | null;
  /** ¿La URL es de un dominio oficial? `null` si no hay base para juzgarlo. */
  official: boolean | null;
  page: PageComparison | null;
  openBadge: OpenBadgeResult | null;
}

/**
 * Estado de la verificación oficial (§18.2).
 *
 *   VERIFIED_MATCH                 — fuente oficial que identifica la credencial y coincide.
 *   REACHABLE_NO_STRUCTURED_PROOF  — responde, pero no expone una prueba que pueda leerse
 *                                    (requiere JavaScript, inicio de sesión, CAPTCHA…).
 *   MISMATCH                       — contradice: dominio no permitido, destinatario de otro,
 *                                    revocada, o dirección que el sistema se niega a consultar.
 *   INCONCLUSIVE                   — no se pudo comprobar (verificador apagado).
 *   UNREACHABLE                    — el proveedor no respondió. No es «falso» (§18.2).
 *   NO_VERIFIER                    — la credencial no trae URL, QR ni insignia verificable.
 */
export function decideCredentialCheck(i: CredentialCheckInput): CredentialCheckStatus {
  if (i.openBadge) {
    if (i.openBadge.revoked || i.openBadge.recipientMatch === false) return CredentialCheckStatus.MISMATCH;
    const fuerte = i.openBadge.recipientMatch === true
      && (i.openBadge.hosted || i.openBadge.proofVerified)
      && i.official === true;
    if (fuerte) return CredentialCheckStatus.VERIFIED_MATCH;
  }
  if (!i.link) return i.openBadge ? CredentialCheckStatus.REACHABLE_NO_STRUCTURED_PROOF : CredentialCheckStatus.NO_VERIFIER;
  if (i.link.status === LinkCheckStatus.BLOCKED) return CredentialCheckStatus.MISMATCH;
  if (i.official === false) return CredentialCheckStatus.MISMATCH;
  if (i.link.status === LinkCheckStatus.UNVERIFIED) return CredentialCheckStatus.INCONCLUSIVE;
  if (i.link.status === LinkCheckStatus.UNAVAILABLE) return CredentialCheckStatus.UNREACHABLE;

  // Disponible. Solo un dominio oficial puede corroborar, y solo si la
  // página nombra al estudiante: el código y la URL los escribe quien
  // registra, y podrían ser los de la credencial de otra persona.
  const p = i.page;
  const identifica = !!p && p.holder && (p.credentialId || p.course);
  if (i.official === true && identifica) return CredentialCheckStatus.VERIFIED_MATCH;
  return CredentialCheckStatus.REACHABLE_NO_STRUCTURED_PROOF;
}

/** Contradicciones que marcan una credencial como FLAGGED (§19). */
export type CredentialContradiction =
  | 'holder_mismatch'
  | 'credential_id_mismatch'
  | 'credential_id_pattern'
  | 'course_mismatch'
  | 'issuer_mismatch'
  | 'verification_mismatch';

export interface BackingInput {
  identity: IdentityMatchStatus;
  check: CredentialCheckStatus;
  /** Documento legible y metadata coherente con lo declarado. */
  metadataCoherent: boolean;
  /** El documento coincide con lo que se esperaba de la oportunidad (§19 SUPPORTED). */
  opportunityContextMatch: boolean;
  /** La URL es oficial y responde, aunque no exponga prueba. */
  officialReachable: boolean;
  contradictions: CredentialContradiction[];
}

/**
 * Nivel de respaldo determinista (§19).
 *
 * FLAGGED gana a todo: una contradicción significativa se señala aunque
 * otra señal sea buena. No se borra nada: queda para revisión (§19).
 * CORROBORATED solo con una señal verificable fuerte; un archivo legible,
 * un OCR coherente o un contexto de oportunidad que coincide dan SUPPORTED.
 */
export function decideCredentialBacking(i: BackingInput): BackingTier {
  if (i.contradictions.length > 0) return BackingTier.FLAGGED;
  if (i.check === CredentialCheckStatus.VERIFIED_MATCH) return BackingTier.CORROBORATED;
  if (i.metadataCoherent || i.opportunityContextMatch || i.officialReachable) return BackingTier.SUPPORTED;
  return BackingTier.DECLARED;
}

/** ¿Puede pedirse la revisión manual excepcional? Solo histórica y sin verificador que concluya. */
export const MANUAL_REVIEW_CHECKS: readonly CredentialCheckStatus[] = [
  CredentialCheckStatus.NO_VERIFIER,
  CredentialCheckStatus.INCONCLUSIVE,
  CredentialCheckStatus.UNREACHABLE,
  CredentialCheckStatus.REACHABLE_NO_STRUCTURED_PROOF,
];
