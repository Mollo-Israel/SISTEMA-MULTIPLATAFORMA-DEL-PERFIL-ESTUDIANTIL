import { Injectable } from '@nestjs/common';
import { CredentialCheckStatus, LinkCheckStatus, QrPresence } from '@perfil/shared';
import type { CredentialCheckResult, LinkCheckResult } from '../entities/validation-record.entity';
import { LinkCheckerService } from './link-checker.service';
import {
  OpenBadgeResult,
  PageComparison,
  comparePage,
  decideCredentialCheck,
  htmlToText,
  isOfficialUrl,
  officialDomainsFor,
  parseOpenBadge,
} from './credential-check.rules';

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
  constructor(private readonly links: LinkCheckerService) {}

  async verify(i: VerifyInput): Promise<VerifyOutput> {
    const candidatos = candidatosDeVerificacion(i);

    const official = officialDomainsFor(i.issuer, i.expectedDomains);
    const qr = i.qrPayloads.length > 0 ? QrPresence.QR_PRESENT : QrPresence.QR_ABSENT;

    let openBadge: OpenBadgeResult | null = i.bakedBadge?.json
      ? parseOpenBadge(i.bakedBadge.json, { fetchedUrl: null, emails: i.emails, holderName: i.holderName })
      : null;

    const elegido = candidatos[0] ?? null;
    let link: LinkCheckResult | null = null;
    let page: PageComparison | null = null;
    let esOficial: boolean | null = null;

    if (elegido) {
      const consultado = await this.links.fetchPage(elegido.url);
      link = consultado.result;
      esOficial = link.status === LinkCheckStatus.BLOCKED
        ? false
        : isOfficialUrl(link.finalUrl ?? elegido.url, official);

      const cuerpo = consultado.body;
      if (cuerpo && link.status === LinkCheckStatus.AVAILABLE) {
        const leido = leerCuerpo(cuerpo, consultado.contentType, link.finalUrl ?? elegido.url, i, openBadge);
        openBadge = leido.openBadge;
        page = leido.page;
      }
    }

    const status: CredentialCheckStatus = decideCredentialCheck({ link, official: esOficial, page, openBadge });
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
