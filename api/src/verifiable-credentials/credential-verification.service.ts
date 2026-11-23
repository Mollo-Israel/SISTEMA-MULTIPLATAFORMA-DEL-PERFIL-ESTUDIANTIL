import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { LinkCheckStatus } from '@perfil/shared';
import { VerifiableCredential } from '../entities/verifiable-credential.entity';
import { LinkCheckerService } from '../validation/link-checker.service';
import { extractPdfText } from '../validation/pdf-text';
import { canonicalize } from './crypto/jcs';
import { verifyProof } from './crypto/data-integrity';
import { pareceJws } from './crypto/jws';
import { decodeStatusList, statusBit } from './crypto/status-list';
import { ProofResult, ProofVerifierService } from './proof-verifier.service';
import { normalizePublicCode } from './public-code';
import { readBakedCredential } from './render/badge-image';
import { readQrFromImage } from './render/image-qr';
import { RECORD_PDF_VERSION, readRecordPdfMarker } from './render/record-pdf';
import { SOURCE_LABEL, VerifiableCredentialsService } from './verifiable-credentials.service';

export type Outcome =
  | 'valid' | 'revoked' | 'suspended' | 'without_effect' | 'invalid' | 'altered' | 'not_found'
  | 'valid_external' | 'unverifiable' | 'expired' | 'document_recognized';

export type CheckStatus = 'ok' | 'fail' | 'warn' | 'skip';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface VerificationReport {
  outcome: Outcome;
  title: string;
  summary: string;
  checks: Check[];
  credential: Record<string, unknown> | null;
  ledger: Record<string, unknown> | null;
  links: Record<string, string> | null;
  file: Record<string, unknown> | null;
  checkedAt: string;
}

const sha256Hex = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const CODIGO_EN_TEXTO = /AF-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{5}/;

const TITULOS: Record<Outcome, string> = {
  valid: 'Registro auténtico y vigente',
  revoked: 'Registro revocado',
  suspended: 'Registro suspendido',
  without_effect: 'Registro sin efecto',
  invalid: 'No supera la verificación',
  altered: 'El archivo fue modificado',
  not_found: 'Código no encontrado',
  valid_external: 'Firma válida de un emisor externo',
  unverifiable: 'No se pudo comprobar la firma',
  expired: 'Credencial vencida',
  document_recognized: 'Documento reconocido',
};

/**
 * Verificador público (V8).
 *
 * Responde siempre con un informe que explica cada comprobación, no solo un
 * «sí» o «no». Una persona ajena al sistema (una empresa, otra universidad)
 * entiende qué se comprobó, qué falló y qué significa.
 *
 * No expone el correo, el motivo de una revocación ni datos internos: solo lo
 * que el propio titular decidió mostrar al compartir el código.
 */
@Injectable()
export class CredentialVerificationService {
  constructor(
    private readonly vcs: VerifiableCredentialsService,
    private readonly proofs: ProofVerifierService,
    private readonly links: LinkCheckerService,
    private readonly dataSource: DataSource,
  ) {}

  private informe(outcome: Outcome, summary: string, partes: Partial<VerificationReport> = {}): VerificationReport {
    return {
      outcome,
      title: TITULOS[outcome],
      summary,
      checks: partes.checks ?? [],
      credential: partes.credential ?? null,
      ledger: partes.ledger ?? null,
      links: partes.links ?? null,
      file: partes.file ?? null,
      checkedAt: new Date().toISOString(),
    };
  }

  // =====================================================================
  //  Por código
  // =====================================================================

  async byCode(entrada: string): Promise<VerificationReport> {
    const code = normalizePublicCode(entrada);
    if (!code) {
      return this.informe('not_found', 'El código no tiene el formato de Afinia o tiene un error de tipeo (el último carácter es de control).', {
        checks: [{ id: 'formato', label: 'Formato del código', status: 'fail', detail: 'AF-XXXX-XXXX-XXXXX con un carácter de control.' }],
      });
    }
    const vc = await this.vcs.findByCode(code);
    if (!vc) {
      return this.informe('not_found', 'El código es válido en su forma, pero no corresponde a ningún registro emitido por Afinia.', {
        checks: [
          { id: 'formato', label: 'Formato del código', status: 'ok', detail: 'El carácter de control coincide.' },
          { id: 'registro', label: 'Registro', status: 'fail', detail: 'No existe en el registro de Afinia.' },
        ],
      });
    }
    return this.reportLocal(vc);
  }

  /**
   * Las comprobaciones de un registro propio. Las de integridad son
   * independientes entre sí: firma, huella, bitácora y clave. Alterar la
   * base no basta para engañarlas, porque la bitácora es inmutable y la
   * firma exige la clave privada, que no está en la base.
   */
  async reportLocal(
    vc: VerifiableCredential,
    extra: { checks?: Check[]; file?: Record<string, unknown>; altered?: boolean; presentedMismatch?: boolean } = {},
  ): Promise<VerificationReport> {
    const checks: Check[] = [{ id: 'registro', label: 'Registro', status: 'ok', detail: `Existe en el registro de Afinia con el código ${vc.publicCode}.` }];

    const key = await this.vcs.keyFor(vc.keyId);
    checks.push(key
      ? { id: 'clave', label: 'Clave del emisor', status: 'ok', detail: `Clave Ed25519 ${vc.keyId}, publicada en el perfil del emisor.` }
      : { id: 'clave', label: 'Clave del emisor', status: 'fail', detail: 'La clave con la que dice estar firmado no está registrada.' });

    const firma = key ? verifyProof(vc.credentialJson, key) : null;
    checks.push(firma?.ok
      ? { id: 'firma', label: 'Firma digital', status: 'ok', detail: 'La firma Data Integrity (eddsa-jcs-2022) corresponde exactamente al contenido.' }
      : { id: 'firma', label: 'Firma digital', status: 'fail', detail: firma && !firma.ok ? firma.reason : 'No se pudo comprobar sin la clave.' });

    const huellaOk = sha256Hex(canonicalize(vc.credentialJson)) === vc.payloadSha256;
    checks.push(huellaOk
      ? { id: 'huella', label: 'Huella del contenido', status: 'ok', detail: `SHA-256 ${vc.payloadSha256.slice(0, 16)}… coincide.` }
      : { id: 'huella', label: 'Huella del contenido', status: 'fail', detail: 'La huella guardada no corresponde al contenido.' });

    const sello = await this.vcs.ledgerSeal(vc.publicCode);
    const selloOk = !!sello.issued && sello.issuedEntryValid && sello.issued.data.payloadSha256 === vc.payloadSha256;
    checks.push(selloOk
      ? { id: 'bitacora', label: 'Bitácora de transparencia', status: 'ok', detail: `Sellado en la entrada n.º ${sello.issued!.seq}, encadenada con la anterior.` }
      : { id: 'bitacora', label: 'Bitácora de transparencia', status: 'fail', detail: sello.issued ? 'La entrada de emisión no coincide o la cadena está rota.' : 'No hay entrada de emisión.' });

    const vigente = await this.vcs.fuenteVigente(this.dataSource, vc.sourceType, vc.sourceId);
    const estado = this.vcs.effectiveStatus(vc, vigente);
    if (vc.revokedAt) checks.push({ id: 'estado', label: 'Revocación', status: 'fail', detail: `Revocado por Dirección el ${vc.revokedAt.toISOString().slice(0, 10)}.` });
    else if (vc.suspendedAt) checks.push({ id: 'estado', label: 'Suspensión', status: 'fail', detail: `Suspendido por Dirección desde el ${vc.suspendedAt.toISOString().slice(0, 10)}.` });
    else checks.push({ id: 'estado', label: 'Revocación y suspensión', status: 'ok', detail: 'No figura en las listas de estado.' });
    checks.push(vigente
      ? { id: 'origen', label: 'Hecho registrado', status: 'ok', detail: `${SOURCE_LABEL[vc.sourceType]}: sigue vigente en Afinia.` }
      : { id: 'origen', label: 'Hecho registrado', status: 'fail', detail: 'El hecho que respaldaba el registro ya no está vigente (por ejemplo, la asistencia se corrigió).' });
    checks.push(...(extra.checks ?? []));

    const integridad = checks.filter((c) => ['clave', 'firma', 'huella', 'bitacora'].includes(c.id)).every((c) => c.status === 'ok');
    let outcome: Outcome;
    let summary: string;
    if (!integridad) {
      outcome = 'invalid';
      summary = 'El registro no supera la comprobación de integridad. No lo dé por válido.';
    } else if (extra.presentedMismatch) {
      outcome = 'invalid';
      summary = 'La credencial presentada no es idéntica a la registrada: fue modificada después de emitirse.';
    } else if (estado === 'revoked') {
      outcome = 'revoked';
      summary = 'El registro es auténtico, pero Dirección lo revocó. Ya no acredita nada.';
    } else if (estado === 'suspended') {
      outcome = 'suspended';
      summary = 'El registro es auténtico, pero está suspendido mientras Dirección lo revisa.';
    } else if (estado === 'without_effect') {
      outcome = 'without_effect';
      summary = 'El registro es auténtico, pero el hecho que lo respaldaba ya no figura como vigente en Afinia.';
    } else if (extra.altered) {
      outcome = 'altered';
      summary = 'El registro existe y es válido, pero este archivo no es el original: alguien lo editó. Pida el código y verifíquelo aquí.';
    } else {
      outcome = 'valid';
      summary = 'El registro es auténtico, está íntegro y sigue vigente.';
    }

    const bases = this.vcs.bases;
    const f = this.vcs.factsOf(vc);
    return this.informe(outcome, summary, {
      checks,
      file: extra.file ?? null,
      credential: {
        code: vc.publicCode,
        sourceType: vc.sourceType,
        sourceLabel: SOURCE_LABEL[vc.sourceType],
        achievementName: vc.achievementName,
        holderName: vc.holderName,
        issuerName: vc.issuerName,
        documentIssuer: vc.documentIssuer,
        documentSha256: vc.documentSha256,
        occurredAt: vc.occurredAt,
        issuedAt: vc.issuedAt,
        narrative: f.narrative,
        status: estado,
        statusSince: vc.revokedAt ?? vc.suspendedAt ?? null,
        keyId: vc.keyId,
        payloadSha256: vc.payloadSha256,
      },
      ledger: {
        seq: sello.issued?.seq ?? null,
        entryHash: sello.issued?.entryHash ?? null,
        events: sello.entries.map((e) => ({ seq: e.seq, event: e.event, at: e.createdAt, hash: e.entryHash })),
        head: sello.head,
      },
      links: bases ? {
        ob3: `${bases.apiBase}/public/credentials/${vc.publicCode}/ob3`,
        ob2Assertion: `${bases.apiBase}/public/credentials/ob2/assertions/${vc.publicCode}`,
        issuer: `${bases.apiBase}/public/credentials/issuer`,
        statusRevocation: `${bases.apiBase}/public/credentials/status/revocation`,
        statusSuspension: `${bases.apiBase}/public/credentials/status/suspension`,
        ledgerHead: `${bases.apiBase}/public/credentials/ledger/head`,
      } : null,
    });
  }

  // =====================================================================
  //  Credencial presentada (JSON o JWT)
  // =====================================================================

  async presented(entrada: unknown, origen?: Record<string, unknown>): Promise<VerificationReport> {
    if (typeof entrada === 'string' && entrada.length > 200_000) throw new BadRequestException('La credencial es demasiado grande.');
    if (typeof entrada === 'string' && /^https?:\/\//i.test(entrada.trim())) return this.byUrl(entrada.trim(), origen);
    const prueba = await this.proofs.verify(entrada);

    // ¿Es una credencial de Afinia? Se reconoce por su id (código) y por la firma local.
    const id = typeof prueba.credential?.id === 'string' ? prueba.credential.id : '';
    const codigo = CODIGO_EN_TEXTO.exec(id)?.[0] ?? null;
    if (codigo && prueba.local) {
      const vc = await this.vcs.findByCode(codigo);
      if (vc) {
        const identica = this.identicaAlRegistro(vc, entrada, prueba);
        const presentada: Check = prueba.verified
          ? identica
            ? { id: 'presentada', label: 'Credencial presentada', status: 'ok', detail: `${prueba.format === 'vc_jwt' ? 'VC-JWT' : 'JSON firmado'} idéntico al registrado, firma válida.` }
            : { id: 'presentada', label: 'Credencial presentada', status: 'fail', detail: 'La firma es válida pero el contenido difiere del registrado.' }
          : { id: 'presentada', label: 'Credencial presentada', status: 'fail', detail: prueba.reason };
        return this.reportLocal(vc, {
          checks: [presentada],
          presentedMismatch: presentada.status === 'fail',
          file: origen,
        });
      }
    }
    return this.reportExternal(prueba, origen);
  }

  private identicaAlRegistro(vc: VerifiableCredential, entrada: unknown, prueba: ProofResult): boolean {
    if (prueba.format === 'vc_jwt') return typeof entrada === 'string' && entrada.trim() === vc.credentialJwt;
    try {
      const doc = typeof entrada === 'string' ? JSON.parse(entrada) : entrada;
      return canonicalize(doc) === canonicalize(vc.credentialJson);
    } catch {
      return false;
    }
  }

  /** Una credencial de otro emisor: firma, emisor, vigencia y estado publicados. */
  private async reportExternal(prueba: ProofResult, origen?: Record<string, unknown>): Promise<VerificationReport> {
    const doc = prueba.credential;
    const checks: Check[] = [];
    if (!doc) {
      return this.informe('unverifiable', prueba.reason || 'No se reconoció una credencial.', {
        checks: [{ id: 'formato', label: 'Formato', status: 'fail', detail: prueba.reason || 'No es una credencial.' }],
        file: origen ?? null,
      });
    }
    const tipos = ([] as unknown[]).concat(doc.type ?? []).map(String);
    const esOb3 = tipos.includes('OpenBadgeCredential') || tipos.includes('AchievementCredential');
    const esOb2 = tipos.includes('Assertion') || doc.type === 'Assertion';
    checks.push({
      id: 'formato', label: 'Formato', status: esOb3 || esOb2 || tipos.includes('VerifiableCredential') ? 'ok' : 'warn',
      detail: esOb3 ? 'Open Badges 3.0 (credencial verificable W3C).' : esOb2 ? 'Open Badges 2.0.' : tipos.join(', ') || 'Sin tipo declarado.',
    });

    // OB 2.0 alojada: la prueba es la propia URL del emisor.
    if (esOb2 && prueba.format === 'none') return this.ob2Alojada(doc, checks, origen);

    checks.push({
      id: 'firma', label: 'Firma digital',
      status: prueba.verified === true ? 'ok' : prueba.verified === false ? 'fail' : 'warn',
      detail: prueba.reason,
    });
    if (prueba.issuerBound !== null) {
      checks.push({
        id: 'emisor', label: 'Clave del emisor', status: prueba.issuerBound ? 'ok' : 'fail',
        detail: prueba.issuerBound ? `La clave pertenece a ${prueba.issuerId}.` : 'La clave no pertenece al emisor declarado.',
      });
    }
    const ahora = Date.now();
    const desde = doc.validFrom ?? doc.issuanceDate;
    const hasta = doc.validUntil ?? doc.expirationDate;
    let vencida = false;
    if (typeof desde === 'string' && Date.parse(desde) > ahora + 300_000) {
      checks.push({ id: 'vigencia', label: 'Vigencia', status: 'fail', detail: `Todavía no es válida (desde ${desde}).` });
    } else if (typeof hasta === 'string' && Date.parse(hasta) < ahora) {
      vencida = true;
      checks.push({ id: 'vigencia', label: 'Vigencia', status: 'fail', detail: `Venció el ${hasta}.` });
    } else {
      checks.push({ id: 'vigencia', label: 'Vigencia', status: 'ok', detail: 'Dentro de su periodo de validez.' });
    }
    const estado = await this.estadoExterno(doc);
    checks.push(...estado);

    const algunaFalla = checks.some((c) => c.status === 'fail');
    let outcome: Outcome;
    let summary: string;
    if (prueba.verified === false || checks.some((c) => c.id === 'emisor' && c.status === 'fail')) {
      outcome = 'invalid';
      summary = 'La firma no es válida: la credencial fue alterada o no la emitió quien dice.';
    } else if (estado.some((c) => c.status === 'fail')) {
      outcome = 'revoked';
      summary = 'La firma es válida, pero el emisor la revocó o suspendió en su lista de estado.';
    } else if (vencida) {
      outcome = 'expired';
      summary = 'La firma es válida, pero la credencial venció.';
    } else if (prueba.verified === true && !algunaFalla) {
      outcome = 'valid_external';
      summary = 'La firma digital es válida y la emitió quien dice. Afinia no responde por el contenido de credenciales de otros emisores.';
    } else {
      outcome = 'unverifiable';
      summary = prueba.reason || 'No se pudo comprobar la firma con los métodos disponibles.';
    }
    const subject = (Array.isArray(doc.credentialSubject) ? doc.credentialSubject[0] : doc.credentialSubject ?? {}) as Record<string, unknown>;
    const achievement = (subject.achievement ?? {}) as Record<string, unknown>;
    const issuer = doc.issuer as Record<string, unknown> | string | undefined;
    return this.informe(outcome, summary, {
      checks,
      file: origen ?? null,
      credential: {
        external: true,
        achievementName: achievement.name ?? doc.name ?? null,
        issuerName: typeof issuer === 'object' ? issuer?.name ?? null : null,
        issuerId: prueba.issuerId,
        issuedAt: desde ?? null,
        format: prueba.format,
      },
    });
  }

  /** Listas de estado de un emisor externo (BitstringStatusListEntry), consultadas con protección SSRF. */
  private async estadoExterno(doc: Record<string, unknown>): Promise<Check[]> {
    const entradas = ([] as unknown[]).concat(doc.credentialStatus ?? []) as Record<string, unknown>[];
    const checks: Check[] = [];
    for (const e of entradas.slice(0, 3)) {
      if (e?.type !== 'BitstringStatusListEntry' && e?.type !== 'StatusList2021Entry') {
        checks.push({ id: 'estado', label: 'Estado', status: 'warn', detail: `Tipo de estado no admitido: ${String(e?.type)}.` });
        continue;
      }
      const url = String(e.statusListCredential ?? '');
      const indice = Number(e.statusListIndex);
      const r = await this.links.fetchPage(url);
      if (r.result.status !== LinkCheckStatus.AVAILABLE || !r.body) {
        checks.push({ id: 'estado', label: `Estado (${String(e.statusPurpose)})`, status: 'warn', detail: 'No se pudo consultar la lista de estado del emisor.' });
        continue;
      }
      try {
        const lista = JSON.parse(r.body) as Record<string, unknown>;
        const pruebaLista = await this.proofs.verify(lista);
        const encoded = String((lista.credentialSubject as Record<string, unknown>)?.encodedList ?? '');
        const bit = statusBit(decodeStatusList(encoded), indice);
        checks.push({
          id: 'estado', label: `Estado (${String(e.statusPurpose)})`, status: bit ? 'fail' : pruebaLista.verified ? 'ok' : 'warn',
          detail: bit ? `El emisor la marcó en su lista (${String(e.statusPurpose)}).`
            : pruebaLista.verified ? 'No figura en la lista firmada del emisor.' : 'No figura en la lista, pero la firma de la lista no se pudo comprobar.',
        });
      } catch {
        checks.push({ id: 'estado', label: 'Estado', status: 'warn', detail: 'La lista de estado del emisor no se pudo leer.' });
      }
    }
    return checks;
  }

  private async ob2Alojada(doc: Record<string, unknown>, checks: Check[], origen?: Record<string, unknown>): Promise<VerificationReport> {
    const id = typeof doc.id === 'string' ? doc.id : null;
    const codigo = id ? CODIGO_EN_TEXTO.exec(id)?.[0] : null;
    const bases = this.vcs.bases;
    if (codigo && bases && id?.startsWith(bases.apiBase)) {
      const vc = await this.vcs.findByCode(codigo);
      if (vc) return this.reportLocal(vc, { file: origen });
    }
    if (!id || !/^https?:\/\//.test(id)) {
      checks.push({ id: 'alojada', label: 'Aserción alojada', status: 'fail', detail: 'La aserción no tiene una URL propia que consultar.' });
      return this.informe('unverifiable', 'Una aserción Open Badges 2.0 sin URL no se puede verificar.', { checks, file: origen ?? null });
    }
    const r = await this.links.fetchPage(id);
    if (r.result.status !== LinkCheckStatus.AVAILABLE || !r.body) {
      checks.push({ id: 'alojada', label: 'Aserción alojada', status: 'warn', detail: `El emisor no respondió (${r.result.status}).` });
      return this.informe('unverifiable', 'No se pudo consultar la aserción en el sitio del emisor.', { checks, file: origen ?? null });
    }
    try {
      const remota = JSON.parse(r.body) as Record<string, unknown>;
      const igual = remota.id === doc.id
        && JSON.stringify(remota.recipient) === JSON.stringify(doc.recipient)
        && JSON.stringify(remota.badge) === JSON.stringify(doc.badge);
      checks.push({ id: 'alojada', label: 'Aserción alojada', status: igual ? 'ok' : 'fail', detail: igual ? 'Coincide con la publicada por el emisor.' : 'Difiere de la publicada por el emisor.' });
      if (remota.revoked === true) {
        checks.push({ id: 'estado', label: 'Revocación', status: 'fail', detail: 'El emisor la revocó.' });
        return this.informe('revoked', 'El emisor revocó esta insignia.', { checks, file: origen ?? null });
      }
      return this.informe(igual ? 'valid_external' : 'invalid', igual
        ? 'La insignia está publicada por su emisor y coincide. Afinia no responde por su contenido.'
        : 'La insignia presentada no coincide con la publicada por el emisor.', { checks, file: origen ?? null });
    } catch {
      checks.push({ id: 'alojada', label: 'Aserción alojada', status: 'fail', detail: 'El emisor no devolvió JSON.' });
      return this.informe('unverifiable', 'La aserción publicada no se pudo leer.', { checks, file: origen ?? null });
    }
  }

  /** Una URL: si es de Afinia, por su código; si no, se descarga la credencial. */
  private async byUrl(url: string, origen?: Record<string, unknown>): Promise<VerificationReport> {
    const codigo = CODIGO_EN_TEXTO.exec(url)?.[0] ?? null;
    if (codigo) {
      const r = await this.byCode(codigo);
      return this.conAvisoDeSitio(r, url, origen);
    }
    const pagina = await this.links.fetchPage(url);
    if (pagina.result.status !== LinkCheckStatus.AVAILABLE || !pagina.body) {
      return this.informe('unverifiable', 'La dirección no respondió o no se permite consultarla.', {
        checks: [{ id: 'url', label: 'Dirección', status: 'warn', detail: `Estado: ${pagina.result.status}.` }], file: origen ?? null,
      });
    }
    return this.presented(pagina.body, origen);
  }

  /** Si el QR o el enlace apuntan a otro sitio, se advierte: puede ser una imitación. */
  private conAvisoDeSitio(r: VerificationReport, url: string, origen?: Record<string, unknown>): VerificationReport {
    const propios = new Set<string>();
    const s = this.vcs.settingsSnapshot();
    for (const b of [s.webBase, s.apiBase]) {
      try {
        if (b) propios.add(new URL(b).host);
      } catch { /* sin base */ }
    }
    let host = '';
    try {
      host = new URL(url).host;
    } catch { /* no es URL */ }
    if (host && !propios.has(host)) {
      r.checks.push({
        id: 'sitio', label: 'Sitio del enlace', status: 'warn',
        detail: `El enlace apunta a ${host}, que no es Afinia. El resultado de arriba es el del registro real; desconfíe de esa página.`,
      });
    }
    if (origen) r.file = { ...(r.file ?? {}), ...origen };
    return r;
  }

  // =====================================================================
  //  Archivo
  // =====================================================================

  async file(buffer: Buffer, nombre: string): Promise<VerificationReport> {
    if (!buffer?.length) throw new BadRequestException('Adjunta un archivo.');
    const sha = sha256Hex(buffer);
    const tipo = this.tipoDeArchivo(buffer);
    const base = { name: nombre.slice(0, 120), sha256: sha, size: buffer.length, kind: tipo };

    // 1. PDF generado por Afinia: se regenera y se compara byte a byte.
    if (tipo === 'pdf') {
      const marca = readRecordPdfMarker(buffer);
      if (marca) {
        const vc = await this.vcs.findByCode(marca.code);
        if (vc) {
          const original = this.vcs.pdf(vc);
          const identico = marca.version === RECORD_PDF_VERSION && sha256Hex(original) === sha;
          const check: Check = identico
            ? { id: 'documento', label: 'Archivo PDF', status: 'ok', detail: 'Idéntico, byte a byte, al PDF que generó Afinia.' }
            : { id: 'documento', label: 'Archivo PDF', status: 'fail', detail: marca.version !== RECORD_PDF_VERSION
              ? 'El PDF es de otra versión del generador: verifique con el código.'
              : 'El PDF no es idéntico al original: fue editado después de descargarse.' };
          return this.reportLocal(vc, { checks: [check], altered: !identico, file: { ...base, recognizedAs: 'afinia_pdf' } });
        }
      }
      const enlaces = extractPdfText(buffer).links;
      const propio = enlaces.find((l) => CODIGO_EN_TEXTO.test(l));
      if (propio) return this.byUrl(propio, { ...base, recognizedAs: 'pdf_link' });
    }

    // 2. Imagen o JSON con la credencial dentro (insignia horneada).
    if (tipo === 'png' || tipo === 'svg') {
      const horneada = readBakedCredential(buffer);
      if (horneada) return this.presented(horneada, { ...base, recognizedAs: 'baked_badge' });
    }
    if (tipo === 'json' || tipo === 'jwt') {
      return this.presented(buffer.toString('utf8').trim(), { ...base, recognizedAs: tipo });
    }

    // 3. Un QR en la imagen.
    if (tipo === 'png' || tipo === 'jpeg') {
      const qr = readQrFromImage(buffer, tipo === 'png' ? 'image/png' : 'image/jpeg');
      if (qr) {
        if (/^https?:\/\//i.test(qr)) return this.byUrl(qr, { ...base, recognizedAs: 'qr', qr: qr.slice(0, 200) });
        if (pareceJws(qr)) return this.presented(qr, { ...base, recognizedAs: 'qr' });
      }
    }

    // 4. La huella del archivo: ¿es un certificado entregado por medio de Afinia?
    return this.porHuella(sha, base);
  }

  private async porHuella(sha: string, base: Record<string, unknown>): Promise<VerificationReport> {
    const registros = await this.vcs.findByDocumentSha(sha);
    if (registros.length === 1) {
      return this.reportLocal(registros[0], {
        checks: [{ id: 'documento', label: 'Archivo', status: 'ok', detail: 'Es exactamente el certificado entregado (misma huella SHA-256).' }],
        file: { ...base, recognizedAs: 'delivered_certificate' },
      });
    }
    const entregas: Array<{ issuer: string | null; title: string | null; n: number; at: string }> = await this.dataSource.query(`
      SELECT c.issuer_name AS issuer, a.title AS title, count(*)::int AS n, min(c.created_at) AS at
        FROM internal_constancies c
        JOIN stored_files f ON f.id = c.stored_file_id
        LEFT JOIN activities a ON a.id = c.activity_id
       WHERE f.sha256 = $1 AND c.kind = 'institution_certificate' AND c.status = 'authorized'
       GROUP BY c.issuer_name, a.title`, [sha]);
    if (entregas.length > 0) {
      const e = entregas[0];
      return this.informe('document_recognized',
        `Este archivo es el certificado que ${e.issuer ?? 'la institución'} entregó por medio de Afinia para «${e.title ?? 'una actividad'}». `
        + 'Para saber a quién, pida a la persona su código de verificación.', {
          checks: [{ id: 'documento', label: 'Archivo', status: 'ok', detail: `Huella SHA-256 reconocida (entregado ${e.n === 1 ? 'a 1 persona' : `a ${e.n} personas`}).` }],
          file: { ...base, recognizedAs: 'delivered_certificate' },
          credential: { documentIssuer: e.issuer, activityTitle: e.title, deliveredAt: e.at },
        });
    }
    return this.informe('not_found',
      'No se reconoce este archivo: no lleva un QR, un enlace ni una insignia de Afinia, y su huella no coincide con ningún certificado entregado.', {
        checks: [{ id: 'documento', label: 'Archivo', status: 'fail', detail: `Huella SHA-256 ${sha.slice(0, 16)}… sin coincidencias.` }],
        file: base,
      });
  }

  private tipoDeArchivo(b: Buffer): 'pdf' | 'png' | 'jpeg' | 'svg' | 'json' | 'jwt' | 'other' {
    if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
    if (b.length > 8 && b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
    if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    const inicio = b.subarray(0, 600).toString('utf8').replace(/^﻿/, '').trimStart();
    if (inicio.startsWith('<?xml') || inicio.startsWith('<svg')) return 'svg';
    if (inicio.startsWith('{')) return 'json';
    if (pareceJws(b.subarray(0, 200_000).toString('utf8').trim())) return 'jwt';
    return 'other';
  }

  // =====================================================================
  //  Lote
  // =====================================================================

  async batch(codigos: string[]) {
    const unicos = [...new Set(codigos.map((c) => String(c).trim()).filter(Boolean))].slice(0, 25);
    const resultados: Array<{ input: string; outcome: Outcome; title: string; holderName: string | null; achievementName: string | null; code: string | null }> = [];
    for (const c of unicos) {
      const r = await this.byCode(c);
      resultados.push({
        input: c.slice(0, 40),
        outcome: r.outcome,
        title: r.title,
        holderName: (r.credential?.holderName as string) ?? null,
        achievementName: (r.credential?.achievementName as string) ?? null,
        code: (r.credential?.code as string) ?? null,
      });
    }
    return {
      results: resultados,
      summary: {
        total: resultados.length,
        valid: resultados.filter((r) => r.outcome === 'valid').length,
        problems: resultados.filter((r) => r.outcome !== 'valid').length,
      },
    };
  }
}
