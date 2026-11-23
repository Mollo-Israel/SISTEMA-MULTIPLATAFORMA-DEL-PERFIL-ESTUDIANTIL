import { Injectable, Logger, Optional } from '@nestjs/common';
import { CredentialCheckStatus, LinkCheckStatus, QrPresence } from '@perfil/shared';
import type { CredentialCheckResult, LinkCheckResult } from '../entities/validation-record.entity';
import { LinkCheckerService } from './link-checker.service';
import { ProofVerifierService } from '../verifiable-credentials/proof-verifier.service';
import { pareceJws } from '../verifiable-credentials/crypto/jws';
import {
  OpenBadgeResult,
  PageComparison,
  comparePage,
  decideCredentialCheck,
  htmlToText,
  isOfficialUrl,
  officialDomainsFor,
  parseOpenBadge,
  phraseFound,
} from './credential-check.rules';
import { credlyAssertionMatches, credlyAssertionUrl, credlyBadgeId } from './credential-integrity.rules';

export interface VerifyInput {
  /** URL declarada por el estudiante. */
  declaredUrl: string | null;
  /** Contenido de los QR leídos del documento. */
  qrPayloads: string[];
  /** URL de verificación encontrada en el texto o en los enlaces del PDF. */
  documentUrl: string | null;
  /** Insignia horneada en un PNG, si la había. */
  bakedBadge: { json: unknown; url: string | null } | null;
  issuer: string | null;
  /** Dominios oficiales esperados por la oportunidad (§12, §17). */
  expectedDomains: string[];
  holderName: string;
  emails: string[];
  credentialId: string | null;
  course: string | null;
  /** V9: el PDF está firmado por el emisor (comprobado) y a nombre del estudiante. */
  signedDocument?: boolean;
}

export interface VerifyOutput {
  check: Omit<CredentialCheckResult, 'contradictions' | 'pipeline' | 'aiUsed'>;
  link: LinkCheckResult | null;
}

const esHttp = (s: string) => /^https?:\/\//i.test(s.trim());

/** Dónde se puede comprobar, por orden de preferencia: lo declarado, el QR, el documento y la insignia. */
function candidatosDeVerificacion(i: VerifyInput): { url: string; source: CredentialCheckResult['urlSource'] }[] {
  const candidatos: { url: string; source: CredentialCheckResult['urlSource'] }[] = [];
  if (i.declaredUrl && esHttp(i.declaredUrl)) candidatos.push({ url: i.declaredUrl, source: 'declared' });
  for (const q of i.qrPayloads) if (esHttp(q)) candidatos.push({ url: q.trim(), source: 'qr' });
  if (i.documentUrl && esHttp(i.documentUrl)) candidatos.push({ url: i.documentUrl, source: 'document' });
  if (i.bakedBadge?.url && esHttp(i.bakedBadge.url)) candidatos.push({ url: i.bakedBadge.url, source: 'badge' });
  return candidatos;
}

/**
 * Lo que dice la página: una insignia en JSON (que reemplaza a la del archivo)
 * o, si no la hay, la comparación de su texto con lo declarado.
 */
function leerCuerpo(
  cuerpo: string,
  contentType: string | null,
  urlConsultada: string,
  i: VerifyInput,
  previa: OpenBadgeResult | null,
): { openBadge: OpenBadgeResult | null; page: PageComparison | null } {
  let openBadge = previa;
  const pareceJson = /json/.test(contentType ?? '') || /^\s*[[{]/.test(cuerpo);
  if (pareceJson) {
    try {
      const badge = parseOpenBadge(JSON.parse(cuerpo), { fetchedUrl: urlConsultada, emails: i.emails, holderName: i.holderName });
      if (badge) openBadge = badge;
    } catch {
      // JSON ilegible: se compara como texto.
    }
  }
  const page = !pareceJson || !openBadge
    ? comparePage(htmlToText(cuerpo), { holderName: i.holderName, credentialId: i.credentialId, course: i.course, issuer: i.issuer })
    : null;
  return { openBadge, page };
}

/** Lo que se guarda de la insignia en el resultado. */
function resumenDeInsignia(ob: OpenBadgeResult | null) {
  if (!ob) return null;
  return {
    format: ob.format,
    recipientMatch: ob.recipientMatch,
    revoked: ob.revoked,
    hosted: ob.hosted,
    proofPresent: ob.proofPresent,
    proofVerified: ob.proofVerified,
    badgeName: ob.badgeName,
    issuerName: ob.issuerName,
    issuerMatches: ob.issuerMatches ?? null,
    provider: ob.provider ?? null,
  };
}

/**
 * Verificación contra la fuente oficial (V3 §18.2, §18.3).
 *
 * 1. elige la URL: la declarada, la del QR, la del documento o la de la insignia;
 * 2. la consulta con la protección SSRF de siempre —también la del QR, que
 *    la escribió quien imprimió el documento, no el sistema—;
 * 3. juzga el dominio contra los oficiales del emisor;
 * 4. compara la página (o la insignia) con lo declarado.
 *
 * No promete universalidad (§20): una página que necesita JavaScript o
 * inicio de sesión queda «responde, sin prueba legible», no «falsa».
 */
@Injectable()
export class CredentialVerifierService {
  private readonly logger = new Logger(CredentialVerifierService.name);

  constructor(
    private readonly links: LinkCheckerService,
    // V8: comprobación criptográfica de la insignia. Opcional: sin ella, todo
    // funciona como antes y `proofVerified` queda en false.
    @Optional() private readonly proofs?: ProofVerifierService,
  ) {}

  /**
   * V8: si la insignia trae firma (Data Integrity o VC-JWT), se comprueba de
   * verdad. Antes `proofVerified` era siempre false: la firma se detectaba,
   * pero no se validaba. Una firma inválida nunca rebaja nada por sí sola; una
   * válida y del emisor cuenta como prueba fuerte (§18.3).
   */
  private async conFirma(ob: OpenBadgeResult | null, crudo: unknown, ctx: { emails: string[]; holderName: string }): Promise<OpenBadgeResult | null> {
    if (!this.proofs || crudo === null || crudo === undefined) return ob;
    const esJwt = typeof crudo === 'string' && pareceJws(crudo);
    if (!esJwt && !ob?.proofPresent) return ob;
    try {
      const r = await this.proofs.verify(crudo);
      let base = ob;
      if (esJwt && r.credential) {
        base = parseOpenBadge(r.credential, { fetchedUrl: null, emails: ctx.emails, holderName: ctx.holderName });
      }
      if (!base) return ob;
      return { ...base, proofPresent: true, proofVerified: r.verified === true && r.issuerBound !== false };
    } catch (e) {
      this.logger.debug(`No se pudo comprobar la firma de la insignia: ${(e as Error).message}`);
      return ob;
    }
  }

  /**
   * V9: Credly guarda la clase de la insignia y su emisor en direcciones
   * aparte. Se consultan (con la misma protección SSRF) para saber **quién**
   * la emitió: en Credly emite cualquier organización, así que una insignia
   * «Cisco» de un emisor que no es Cisco no corrobora nada.
   */
  private async completarCredly(ob: OpenBadgeResult, i: VerifyInput): Promise<OpenBadgeResult> {
    let badgeName = ob.badgeName;
    let issuerName = ob.issuerName;
    let issuerUrl: string | null = null;
    try {
      const clase = ob.badgeUrl ? await this.json(ob.badgeUrl) : null;
      if (clase) {
        badgeName = typeof clase.name === 'string' ? clase.name.slice(0, 200) : badgeName;
        const emisor = typeof clase.issuer === 'string' ? await this.json(clase.issuer) : clase.issuer;
        if (emisor && typeof emisor === 'object') {
          issuerName = typeof emisor.name === 'string' ? emisor.name.slice(0, 200) : issuerName;
          issuerUrl = typeof emisor.url === 'string' ? emisor.url : null;
        }
      }
    } catch (e) {
      this.logger.debug(`No se pudo completar la insignia de Credly: ${(e as Error).message}`);
    }
    return { ...ob, badgeName, issuerName, issuerMatches: emisorCoincide(issuerName, issuerUrl, i) };
  }

  /** JSON de una dirección pública, con la protección SSRF del verificador de enlaces. */
  private async json(url: string): Promise<Record<string, any> | null> {
    const r = await this.links.fetchPage(url);
    if (r.result.status !== LinkCheckStatus.AVAILABLE || !r.body) return null;
    try {
      const v = JSON.parse(r.body);
      return v && typeof v === 'object' ? v : null;
    } catch {
      return null;
    }
  }

  async verify(i: VerifyInput): Promise<VerifyOutput> {
    const candidatos = candidatosDeVerificacion(i);

    const official = officialDomainsFor(i.issuer, i.expectedDomains);
    const qr = i.qrPayloads.length > 0 ? QrPresence.QR_PRESENT : QrPresence.QR_ABSENT;

    let openBadge: OpenBadgeResult | null = i.bakedBadge?.json
      ? parseOpenBadge(i.bakedBadge.json, { fetchedUrl: null, emails: i.emails, holderName: i.holderName })
      : null;
    // V8: el documento original de la insignia, para comprobar su firma.
    let crudo: unknown = i.bakedBadge?.json ?? null;

    // V9: si alguno de los candidatos es una insignia de Credly, se usa ese:
    // es el único proveedor con una fuente oficial consultable en JSON.
    const credly = candidatos.find((c) => credlyBadgeId(c.url));
    const elegido = credly ?? candidatos[0] ?? null;
    const credlyId = credly ? credlyBadgeId(credly.url) : null;
    let link: LinkCheckResult | null = null;
    let page: PageComparison | null = null;
    let esOficial: boolean | null = null;

    if (elegido) {
      // Credly: en lugar de la página (que se arma con JavaScript), su
      // aserción Open Badges oficial.
      const consultado = await this.links.fetchPage(credlyAssertionUrl(elegido.url) ?? elegido.url);
      link = consultado.result;
      esOficial = link.status === LinkCheckStatus.BLOCKED
        ? false
        : isOfficialUrl(link.finalUrl ?? elegido.url, official);

      const cuerpo = consultado.body;
      if (cuerpo && link.status === LinkCheckStatus.AVAILABLE) {
        const anterior = openBadge;
        const leido = leerCuerpo(cuerpo, consultado.contentType, link.finalUrl ?? elegido.url, i, openBadge);
        openBadge = leido.openBadge;
        page = leido.page;
        if (openBadge !== anterior) {
          try {
            crudo = JSON.parse(cuerpo);
          } catch {
            // ya se comparó como texto
          }
        } else if (pareceJws(cuerpo.trim())) {
          crudo = cuerpo.trim();
        }
      }
    }
    openBadge = await this.conFirma(openBadge, crudo, { emails: i.emails, holderName: i.holderName });
    if (openBadge && credlyId && credlyAssertionMatches((crudo as { id?: unknown } | null)?.id, credlyId)) {
      // La aserción vino de la API oficial de Credly y es la de esa insignia:
      // es la verificación «hosted» del estándar.
      openBadge = await this.completarCredly({ ...openBadge, hosted: true, provider: 'credly' }, i);
    }

    const status: CredentialCheckStatus = decideCredentialCheck({
      link, official: esOficial, page, openBadge, signedDocument: i.signedDocument === true,
    });
    return {
      link,
      check: {
        status,
        url: elegido?.url ?? null,
        urlSource: elegido?.source ?? null,
        finalUrl: link?.finalUrl ?? null,
        official: esOficial,
        officialDomains: official ? official.slice(0, 20) : null,
        qr,
        page,
        openBadge: resumenDeInsignia(openBadge),
        checkedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * V9: ¿el emisor de la insignia es el declarado? Por nombre (alguna palabra
 * distintiva del emisor declarado) o por el dominio de su sitio frente a los
 * dominios oficiales conocidos de ese emisor. `null` si no hay con qué juzgar.
 */
export function emisorCoincide(issuerName: string | null, issuerUrl: string | null, i: Pick<VerifyInput, 'issuer' | 'expectedDomains'>): boolean | null {
  if (!issuerName && !issuerUrl) return null;
  if (!i.issuer && i.expectedDomains.length === 0) return null;
  if (issuerName && i.issuer && (phraseFound(issuerName, i.issuer, 0.5) || phraseFound(i.issuer, issuerName, 0.5))) return true;
  // Solo los dominios del emisor (sin las plataformas de insignias: que la
  // insignia viva en Credly no dice nada de quién la emitió).
  const propios = (officialDomainsFor(i.issuer, i.expectedDomains) ?? [])
    .filter((d) => !['credly.com', 'youracclaim.com', 'accredible.com', 'credential.net', 'badgr.com', 'badgr.io', 'openbadgefactory.com', 'parchment.com'].includes(d));
  if (issuerUrl && propios.length) {
    try {
      const host = new URL(issuerUrl).hostname.toLowerCase();
      if (propios.some((d) => host === d || host.endsWith(`.${d}`))) return true;
    } catch {
      // sitio ilegible: no suma
    }
  }
  return false;
}
