import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { VerifiableCredential, CredentialSourceType } from '../entities/verifiable-credential.entity';
import { CredentialIssuancePolicy } from '../entities/credential-issuance-policy.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { CredentialKeysService } from './credential-keys.service';
import { CredentialLedgerService } from './credential-ledger.service';
import { ProofVerifierService } from './proof-verifier.service';
import { CredentialsSettings, RUTAS, paginaDeVerificacion, readCredentialsSettings } from './credentials.config';
import { canonicalize } from './crypto/jcs';
import { createProof, verifyProof } from './crypto/data-integrity';
import { signJwsEdDSA } from './crypto/jws';
import { fromMultikey, toJwk } from './crypto/keys';
import { STATUS_LIST_SIZE, encodeStatusList } from './crypto/status-list';
import {
  Bases, CredentialFacts, buildIssuerProfile, buildOb2Assertion, buildOb2BadgeClass, buildOb2Issuer, buildOb3Credential,
  buildStatusListCredential, criteriaNarrative, hashIdentity, issuerId, linkedInAddUrl, verificationMethodId,
} from './open-badges';
import { generatePublicCode } from './public-code';
import { badgeSvg, bakedBadgePng } from './render/badge-image';
import { renderRecordPdf } from './render/record-pdf';
import { encodeQr, qrToSvg } from '../collaboration/qr-encoder';

/** Estado efectivo de un registro, combinando lo que decidió Dirección y su origen. */
export type EffectiveStatus = 'active' | 'suspended' | 'without_effect' | 'revoked';

export const SOURCE_LABEL: Record<CredentialSourceType, string> = {
  participation: 'Participación confirmada',
  institution_certificate: 'Certificado institucional entregado',
  internal_constancy: 'Constancia histórica',
};

export interface EligibleSource {
  sourceType: CredentialSourceType;
  sourceId: string;
  activityId: string | null;
  activityTitle: string | null;
  occurredAt: Date | null;
  activityEndAt: Date | null;
  documentIssuer: string | null;
  documentSha256: string | null;
}

/** Mínimo para justificar una decisión de Dirección: una frase de verdad. */
const MIN_MOTIVO = 10;

const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * Registros verificables (V8).
 *
 * Firma lo que Afinia ya registra y lo deja comprobable por cualquiera:
 * Open Badges 3.0 (Data Integrity + VC-JWT), Open Badges 2.0 alojado, PDF
 * con QR, e insignias horneadas. Cada hecho importante queda en la bitácora
 * encadenada, y la base impide reescribir lo firmado.
 *
 * Nada de esto toca los flujos existentes: lee participaciones y constancias
 * y calcula su vigencia en vivo. Si una participación deja de estar
 * confirmada, su registro aparece «sin efecto» de inmediato, sin que el
 * módulo de actividades tenga que avisar.
 */
@Injectable()
export class VerifiableCredentialsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(VerifiableCredentialsService.name);
  private readonly settings: CredentialsSettings;
  private cacheListas: { at: number; listas: Record<'revocation' | 'suspension', Record<string, unknown>> } | null = null;

  constructor(
    config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(VerifiableCredential) private readonly credentials: Repository<VerifiableCredential>,
    @InjectRepository(CredentialIssuancePolicy) private readonly policies: Repository<CredentialIssuancePolicy>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    private readonly keys: CredentialKeysService,
    private readonly ledger: CredentialLedgerService,
    private readonly audit: AuditService,
    private readonly proofs: ProofVerifierService,
  ) {
    this.settings = readCredentialsSettings(config);
  }

  onApplicationBootstrap(): void {
    // Las firmas propias se verifican con la base, sin salir a la red: así
    // un verificador detrás de un firewall (o en desarrollo) igual funciona.
    const prefijo = this.settings.apiBase ? `${issuerId({ apiBase: this.settings.apiBase })}#` : null;
    this.proofs.registerLocalResolver(async (vm) => {
      if (!prefijo || !vm.startsWith(prefijo)) return null;
      const key = await this.keys.publicKey(vm.slice(prefijo.length));
      return key ? { key, controller: prefijo.slice(0, -1) } : null;
    });
  }

  get bases(): Bases | null {
    return this.settings.apiBase
      ? { apiBase: this.settings.apiBase, webBase: this.settings.webBase, issuerName: this.settings.issuerName }
      : null;
  }

  private requireBases(): Bases {
    const b = this.bases;
    if (!b) {
      throw new ServiceUnavailableException({
        code: 'CREDENTIALS_NOT_CONFIGURED',
        message: 'Falta CREDENTIALS_PUBLIC_API_URL: sin una dirección pública estable no se puede firmar.',
      });
    }
    return b;
  }

  // =====================================================================
  //  Política (V5 ND-01)
  // =====================================================================

  async policy() {
    const historia = await this.policies.find({ order: { decidedAt: 'DESC' }, take: 20 });
    const vigente = historia[0] ?? null;
    const nombres = await this.nombres(historia.map((h) => h.decidedBy));
    return {
      enabled: vigente?.enabled ?? false,
      decidedAt: vigente?.decidedAt ?? null,
      decidedBy: vigente ? nombres.get(vigente.decidedBy) ?? null : null,
      justification: vigente?.justification ?? null,
      configured: !!this.bases,
      history: historia.map((h) => ({
        enabled: h.enabled, justification: h.justification, decidedAt: h.decidedAt, decidedBy: nombres.get(h.decidedBy) ?? null,
      })),
    };
  }

  async isEnabled(): Promise<boolean> {
    const [vigente] = await this.policies.find({ order: { decidedAt: 'DESC' }, take: 1 });
    return vigente?.enabled ?? false;
  }

  async setPolicy(user: AuthenticatedUser, enabled: boolean, justification: string) {
    if (user.role !== RolNombre.CAREER_DIRECTOR) {
      throw new ForbiddenException('Solo Dirección decide la política de emisión (V5 ND-01).');
    }
    const motivo = (justification ?? '').trim();
    if (motivo.length < MIN_MOTIVO) {
      throw new BadRequestException({
        message: 'Explica la decisión en una frase.',
        fields: { justification: [`Escribe al menos ${MIN_MOTIVO} caracteres.`] },
      });
    }
    if ((await this.isEnabled()) === enabled) {
      throw new ConflictException(enabled ? 'La emisión ya está habilitada.' : 'La emisión ya está apagada.');
    }
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CredentialIssuancePolicy);
      const fila = await repo.save(repo.create({ enabled, justification: motivo.slice(0, 500), decidedBy: user.userId }));
      await this.ledger.append(manager, {
        event: 'POLICY_CHANGED',
        data: { enabled, policyId: fila.id, justificationSha256: sha256Hex(motivo) },
        actorUserId: user.userId,
      });
      await this.audit.record({
        actorUserId: user.userId,
        eventType: AuditEventType.CREDENTIAL_POLICY_CHANGED,
        entityType: 'credential_policy',
        entityId: fila.id,
        metadata: { enabled, motivo: motivo.slice(0, 200) },
      }, manager);
    });
    return this.policy();
  }

  // =====================================================================
  //  Qué se puede emitir
  // =====================================================================

  /** Hechos del estudiante que todavía no tienen registro verificable. */
  async eligibleFor(profileId: string): Promise<EligibleSource[]> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(`
      SELECT 'participation' AS source_type, r.id AS source_id, a.id AS activity_id, a.title AS activity_title,
             a.event_date AS occurred_at, a.end_at AS end_at, NULL::text AS document_issuer, NULL::text AS document_sha256
        FROM activity_registrations r
        JOIN activities a ON a.id = r.activity_id
       WHERE r.student_profile_id = $1 AND r.status = 'confirmed'
         AND a.origin_type = 'internal' AND a.status NOT IN ('draft', 'cancelled')
      UNION ALL
      SELECT c.kind, c.id, a.id, COALESCE(a.title, c.description), a.event_date, a.end_at,
             CASE WHEN c.kind = 'institution_certificate' THEN c.issuer_name END, f.sha256
        FROM internal_constancies c
        LEFT JOIN activities a ON a.id = c.activity_id
        LEFT JOIN stored_files f ON f.id = c.stored_file_id
       WHERE c.student_profile_id = $1 AND c.status = 'authorized'
         AND c.kind IN ('institution_certificate', 'internal_constancy')`, [profileId]);
    const yaEmitidos = new Set(
      (await this.credentials.find({ where: { studentProfileId: profileId }, select: { sourceType: true, sourceId: true } }))
        .map((c) => `${c.sourceType}:${c.sourceId}`),
    );
    return filas
      .filter((f) => !yaEmitidos.has(`${f.source_type}:${f.source_id}`))
      .map((f) => ({
        sourceType: f.source_type as CredentialSourceType,
        sourceId: String(f.source_id),
        activityId: (f.activity_id as string) ?? null,
        activityTitle: (f.activity_title as string) ?? null,
        occurredAt: f.occurred_at ? new Date(f.occurred_at as string) : null,
        activityEndAt: f.end_at ? new Date(f.end_at as string) : null,
        documentIssuer: (f.document_issuer as string) ?? null,
        documentSha256: (f.document_sha256 as string)?.trim() || null,
      }))
      .sort((a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0));
  }

  private nombreDeLogro(s: EligibleSource): string {
    const t = (s.activityTitle ?? 'actividad').trim();
    const nombre = s.sourceType === 'participation'
      ? `Participación en «${t}»`
      : s.sourceType === 'institution_certificate' ? `Certificado de «${t}»` : `Constancia de «${t}»`;
    return nombre.slice(0, 300);
  }

  // =====================================================================
  //  Emisión
  // =====================================================================

  private async exigirEmisionPosible(): Promise<Bases> {
    const bases = this.requireBases();
    if (!(await this.isEnabled())) {
      throw new ForbiddenException({
        code: 'CREDENTIAL_ISSUANCE_DISABLED',
        message: 'Dirección no habilitó la emisión de registros verificables (V5 ND-01). Lo ya emitido se sigue verificando.',
      });
    }
    return bases;
  }

  /** El estudiante pide sus registros: se firman todos los que falten. */
  async issueMine(user: AuthenticatedUser) {
    const profile = await this.perfilDe(user.userId);
    const bases = await this.exigirEmisionPosible();
    const emitidos = await this.issueForProfile(profile, bases, user.userId);
    return { issued: emitidos.length, items: await this.mine(user) };
  }

  /** Dirección emite lo pendiente de una actividad (o de todos), por lotes. */
  async issuePending(user: AuthenticatedUser, activityId?: string) {
    if (user.role !== RolNombre.CAREER_DIRECTOR) throw new ForbiddenException('Solo Dirección emite en lote.');
    const bases = await this.exigirEmisionPosible();
    const ids: Array<{ student_profile_id: string }> = await this.dataSource.query(`
      SELECT DISTINCT student_profile_id FROM (
        SELECT r.student_profile_id FROM activity_registrations r JOIN activities a ON a.id = r.activity_id
         WHERE r.status = 'confirmed' AND a.origin_type = 'internal' AND a.status NOT IN ('draft', 'cancelled')
           AND ($1::uuid IS NULL OR a.id = $1::uuid)
        UNION
        SELECT c.student_profile_id FROM internal_constancies c
         WHERE c.status = 'authorized' AND ($1::uuid IS NULL OR c.activity_id = $1::uuid)
      ) t LIMIT 500`, [activityId ?? null]);
    let total = 0;
    for (const { student_profile_id } of ids) {
      const profile = await this.profiles.findOne({ where: { id: student_profile_id }, relations: { user: true } });
      if (!profile) continue;
      const emitidos = await this.issueForProfile(profile, bases, user.userId, activityId);
      total += emitidos.length;
    }
    return { issued: total, students: ids.length };
  }

  private async issueForProfile(profile: StudentProfile, bases: Bases, actorId: string, activityId?: string) {
    const fuentes = (await this.eligibleFor(profile.id)).filter((s) => !activityId || s.activityId === activityId);
    const emitidos: VerifiableCredential[] = [];
    for (const fuente of fuentes) {
      const vc = await this.issueOne(profile, fuente, bases, actorId);
      if (vc) emitidos.push(vc);
    }
    return emitidos;
  }

  /**
   * Firma un hecho y lo registra.
   *
   * Todo ocurre en una transacción con un candado de emisión: el código, la
   * posición en la lista de estado y la entrada de bitácora no pueden
   * chocar con otra emisión simultánea. Si algo falla, no queda nada a medias.
   */
  private async issueOne(profile: StudentProfile, s: EligibleSource, bases: Bases, actorId: string): Promise<VerifiableCredential | null> {
    const signer = await this.keys.ensureSigner();
    const user = profile.user;
    if (!user) throw new Error('Perfil sin usuario.');
    const holderName = `${user.firstName} ${user.lastName}`.replace(/\s+/g, ' ').trim().slice(0, 200);

    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext('afinia:credential-issue')::bigint)`);
      const repo = manager.getRepository(VerifiableCredential);
      if (await repo.exists({ where: { sourceType: s.sourceType, sourceId: s.sourceId } })) return null;
      // El hecho tiene que seguir vigente en este instante.
      if (!(await this.fuenteVigente(manager, s.sourceType, s.sourceId))) return null;

      const code = await this.codigoLibre(manager);
      const statusIndex = await this.indiceLibre(manager);
      const salt = randomBytes(12).toString('hex');
      const issuedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
      const facts: CredentialFacts = {
        code,
        sourceType: s.sourceType,
        achievementName: this.nombreDeLogro(s),
        activityTitle: s.activityTitle,
        holderName,
        recipientHash: hashIdentity(user.email, salt),
        recipientSalt: salt,
        issuerName: bases.issuerName,
        documentIssuer: s.documentIssuer,
        documentSha256: s.documentSha256,
        occurredAt: s.occurredAt,
        activityEndAt: s.activityEndAt,
        issuedAt,
        statusIndex,
      };
      const sinFirmar = buildOb3Credential(facts, bases);
      const vm = verificationMethodId(bases, signer.kid);
      const firmado = createProof(sinFirmar, signer.pair.privateKey, { verificationMethod: vm, created: issuedAt.toISOString() });
      // Comprobación inmediata: nunca se guarda una firma que no verifica.
      if (!verifyProof(firmado, signer.pair.publicKey).ok) throw new Error('La firma recién creada no verifica.');
      const jwt = signJwsEdDSA(
        { kid: vm, typ: 'vc+jwt', cty: 'vc' },
        { ...sinFirmar, iss: issuerId(bases), jti: sinFirmar.id, nbf: Math.floor(issuedAt.getTime() / 1000) },
        signer.pair.privateKey,
      );
      const payloadSha256 = sha256Hex(canonicalize(firmado));

      const vc = await repo.save(repo.create({
        publicCode: code,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        studentProfileId: profile.id,
        activityId: s.activityId,
        achievementName: facts.achievementName,
        holderName,
        issuerName: bases.issuerName,
        documentIssuer: s.documentIssuer,
        documentSha256: s.documentSha256,
        occurredAt: s.occurredAt,
        issuedAt,
        credentialJson: firmado,
        credentialJwt: jwt,
        payloadSha256,
        keyId: signer.kid,
        statusIndex,
        recipientSalt: salt,
        recipientHash: facts.recipientHash,
        issuedBy: actorId,
      }));
      await this.ledger.append(manager, {
        event: 'ISSUED',
        publicCode: code,
        data: {
          credentialId: vc.id, sourceType: s.sourceType, payloadSha256, statusIndex, kid: signer.kid, issuedAt: issuedAt.toISOString(),
          ...(s.documentSha256 ? { documentSha256: s.documentSha256 } : {}),
        },
        actorUserId: actorId,
      });
      await this.audit.record({
        actorUserId: actorId,
        eventType: AuditEventType.CREDENTIAL_ISSUED,
        entityType: 'verifiable_credential',
        entityId: vc.id,
        metadata: { code, kind: s.sourceType, studentProfileId: profile.id, activityId: s.activityId },
      }, manager);
      this.cacheListas = null;
      return vc;
    });
  }

  private async codigoLibre(manager: EntityManager): Promise<string> {
    for (let i = 0; i < 10; i += 1) {
      const code = generatePublicCode();
      const [ocupado] = await manager.query('SELECT 1 FROM verifiable_credentials WHERE public_code = $1', [code]);
      if (!ocupado) return code;
    }
    throw new Error('No se encontró un código libre.');
  }

  /**
   * Posición aleatoria en la lista de estado (Bitstring Status List §6.1):
   * una posición secuencial revelaría el orden de emisión.
   */
  private async indiceLibre(manager: EntityManager): Promise<number> {
    for (let i = 0; i < 50; i += 1) {
      const indice = randomInt(0, STATUS_LIST_SIZE);
      const [ocupado] = await manager.query('SELECT 1 FROM verifiable_credentials WHERE status_index = $1', [indice]);
      if (!ocupado) return indice;
    }
    throw new Error('La lista de estado está casi llena.');
  }

  /** ¿El hecho de origen sigue vigente ahora? */
  async fuenteVigente(manager: EntityManager | DataSource, sourceType: CredentialSourceType, sourceId: string): Promise<boolean> {
    if (sourceType === 'participation') {
      const [r] = await manager.query(`SELECT status FROM activity_registrations WHERE id = $1`, [sourceId]);
      return r?.status === 'confirmed';
    }
    const [c] = await manager.query(`SELECT status FROM internal_constancies WHERE id = $1`, [sourceId]);
    return c?.status === 'authorized';
  }

  effectiveStatus(vc: VerifiableCredential, fuenteVigente: boolean): EffectiveStatus {
    if (vc.revokedAt) return 'revoked';
    if (vc.suspendedAt) return 'suspended';
    if (!fuenteVigente) return 'without_effect';
    return 'active';
  }

  /** Vigencia del origen de muchos registros en una sola consulta. */
  private async vigencias(ids: string[]): Promise<Map<string, boolean>> {
    if (!ids.length) return new Map();
    const filas: Array<{ id: string; vigente: boolean }> = await this.dataSource.query(`
      SELECT v.id,
             CASE v.source_type
               WHEN 'participation' THEN EXISTS (SELECT 1 FROM activity_registrations r WHERE r.id = v.source_id AND r.status = 'confirmed')
               ELSE EXISTS (SELECT 1 FROM internal_constancies c WHERE c.id = v.source_id AND c.status = 'authorized')
             END AS vigente
        FROM verifiable_credentials v WHERE v.id = ANY($1::uuid[])`, [ids]);
    return new Map(filas.map((f) => [f.id, f.vigente]));
  }

  // =====================================================================
  //  Listas de estado
  // =====================================================================

  /** Listas de revocación y suspensión firmadas. Se recalculan como mucho cada 30 s. */
  async statusList(proposito: 'revocation' | 'suspension'): Promise<Record<string, unknown>> {
    const bases = this.requireBases();
    if (this.cacheListas && Date.now() - this.cacheListas.at < 30_000) return this.cacheListas.listas[proposito];
    const filas: Array<{ status_index: number; revocada: boolean; suspendida: boolean }> = await this.dataSource.query(`
      SELECT v.status_index,
             v.revoked_at IS NOT NULL AS revocada,
             (v.suspended_at IS NOT NULL OR NOT CASE v.source_type
               WHEN 'participation' THEN EXISTS (SELECT 1 FROM activity_registrations r WHERE r.id = v.source_id AND r.status = 'confirmed')
               ELSE EXISTS (SELECT 1 FROM internal_constancies c WHERE c.id = v.source_id AND c.status = 'authorized')
             END) AS suspendida
        FROM verifiable_credentials v`);
    const signer = await this.keys.ensureSigner();
    const ahora = new Date(Math.floor(Date.now() / 1000) * 1000);
    const firmar = (p: 'revocation' | 'suspension', indices: number[]) => createProof(
      buildStatusListCredential(bases, p, encodeStatusList(indices), ahora),
      signer.pair.privateKey,
      { verificationMethod: verificationMethodId(bases, signer.kid), created: ahora.toISOString() },
    );
    const listas = {
      revocation: firmar('revocation', filas.filter((f) => f.revocada).map((f) => f.status_index)),
      suspension: firmar('suspension', filas.filter((f) => f.suspendida && !f.revocada).map((f) => f.status_index)),
    };
    this.cacheListas = { at: Date.now(), listas };
    return listas[proposito];
  }

  async issuerProfile() {
    const bases = this.requireBases();
    await this.keys.ensureSigner();
    const keys = await this.keys.listPublic();
    return buildIssuerProfile(bases, keys);
  }

  async jwks() {
    const keys = await this.keys.listPublic();
    const bases = this.bases;
    return {
      keys: keys.map((k) => ({
        ...toJwk(fromMultikey(k.publicKeyMultibase)), kid: bases ? verificationMethodId(bases, k.id) : k.id, alg: 'EdDSA', use: 'sig',
      })),
    };
  }

  // =====================================================================
  //  Dirección: suspender, levantar, revocar
  // =====================================================================

  private exigirDireccion(user: AuthenticatedUser) {
    if (user.role !== RolNombre.CAREER_DIRECTOR) {
      throw new ForbiddenException('Solo Dirección suspende o revoca registros verificables.');
    }
  }

  private motivoValido(reason: string): string {
    const m = (reason ?? '').trim();
    if (m.length < MIN_MOTIVO) {
      throw new BadRequestException({ message: 'Indica el motivo.', fields: { reason: [`Escribe al menos ${MIN_MOTIVO} caracteres.`] } });
    }
    return m.slice(0, 500);
  }

  async suspend(user: AuthenticatedUser, id: string, reason: string) {
    this.exigirDireccion(user);
    const motivo = this.motivoValido(reason);
    return this.cambiarEstado(id, user, async (vc, manager) => {
      if (vc.revokedAt) throw new ConflictException('El registro ya está revocado: la revocación es definitiva.');
      if (vc.suspendedAt) throw new ConflictException('El registro ya está suspendido.');
      await manager.update(VerifiableCredential, { id }, { suspendedAt: new Date(), suspendedBy: user.userId, suspensionReason: motivo });
      return { event: 'SUSPENDED' as const, audit: AuditEventType.CREDENTIAL_SUSPENDED, motivo };
    });
  }

  async liftSuspension(user: AuthenticatedUser, id: string, reason: string) {
    this.exigirDireccion(user);
    const motivo = this.motivoValido(reason);
    return this.cambiarEstado(id, user, async (vc, manager) => {
      if (vc.revokedAt) throw new ConflictException('El registro está revocado: la revocación es definitiva.');
      if (!vc.suspendedAt) throw new ConflictException('El registro no está suspendido.');
      await manager.update(VerifiableCredential, { id }, { suspendedAt: null, suspendedBy: null, suspensionReason: null });
      return { event: 'SUSPENSION_LIFTED' as const, audit: AuditEventType.CREDENTIAL_SUSPENSION_LIFTED, motivo };
    });
  }

  async revoke(user: AuthenticatedUser, id: string, reason: string) {
    this.exigirDireccion(user);
    const motivo = this.motivoValido(reason);
    return this.cambiarEstado(id, user, async (vc, manager) => {
      if (vc.revokedAt) throw new ConflictException('El registro ya está revocado.');
      await manager.update(VerifiableCredential, { id }, { revokedAt: new Date(), revokedBy: user.userId, revocationReason: motivo });
      return { event: 'REVOKED' as const, audit: AuditEventType.CREDENTIAL_REVOKED, motivo };
    });
  }

  private async cambiarEstado(
    id: string,
    user: AuthenticatedUser,
    accion: (vc: VerifiableCredential, manager: EntityManager) => Promise<{
      event: 'SUSPENDED' | 'SUSPENSION_LIFTED' | 'REVOKED'; audit: (typeof AuditEventType)[keyof typeof AuditEventType]; motivo: string;
    }>,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const vc = await manager.getRepository(VerifiableCredential).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!vc) throw new NotFoundException('Registro no encontrado.');
      const r = await accion(vc, manager);
      await this.ledger.append(manager, {
        event: r.event,
        publicCode: vc.publicCode,
        data: { credentialId: vc.id, reasonSha256: sha256Hex(r.motivo), at: new Date().toISOString() },
        actorUserId: user.userId,
      });
      await this.audit.record({
        actorUserId: user.userId,
        eventType: r.audit,
        entityType: 'verifiable_credential',
        entityId: vc.id,
        metadata: { code: vc.publicCode, motivo: r.motivo.slice(0, 200) },
      }, manager);
    });
    this.cacheListas = null;
    return this.detail(id);
  }

  // =====================================================================
  //  Consultas
  // =====================================================================

  private async perfilDe(userId: string): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { userId }, relations: { user: true } });
    if (!profile) throw new BadRequestException('Aún no has creado tu perfil estudiantil.');
    return profile;
  }

  private async nombres(ids: (string | null)[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unicos.length) return new Map();
    const filas: Array<{ id: string; nombre: string }> = await this.dataSource.query(
      `SELECT id, trim(first_name || ' ' || last_name) AS nombre FROM users WHERE id = ANY($1::uuid[])`, [unicos],
    );
    return new Map(filas.map((f) => [f.id, f.nombre]));
  }

  /** Vista de un registro para su titular o para Dirección. */
  private vista(vc: VerifiableCredential, vigente: boolean, nombres?: Map<string, string>) {
    const bases = this.bases;
    const status = this.effectiveStatus(vc, vigente);
    return {
      id: vc.id,
      code: vc.publicCode,
      sourceType: vc.sourceType,
      sourceLabel: SOURCE_LABEL[vc.sourceType],
      achievementName: vc.achievementName,
      holderName: vc.holderName,
      issuerName: vc.issuerName,
      documentIssuer: vc.documentIssuer,
      documentSha256: vc.documentSha256,
      activityId: vc.activityId,
      occurredAt: vc.occurredAt,
      issuedAt: vc.issuedAt,
      status,
      sourceValid: vigente,
      suspendedAt: vc.suspendedAt,
      suspensionReason: vc.suspensionReason,
      revokedAt: vc.revokedAt,
      revocationReason: vc.revocationReason,
      revokedBy: vc.revokedBy && nombres ? nombres.get(vc.revokedBy) ?? null : null,
      suspendedBy: vc.suspendedBy && nombres ? nombres.get(vc.suspendedBy) ?? null : null,
      payloadSha256: vc.payloadSha256,
      keyId: vc.keyId,
      verifyUrl: paginaDeVerificacion(this.settings.webBase, vc.publicCode),
      linkedInUrl: bases ? linkedInAddUrl({ code: vc.publicCode, achievementName: vc.achievementName, issuedAt: vc.issuedAt }, bases) : null,
      ob2AssertionUrl: bases ? `${bases.apiBase}${RUTAS.ob2Assertion(vc.publicCode)}` : null,
      ob3Url: bases ? `${bases.apiBase}${RUTAS.credential(vc.publicCode)}` : null,
    };
  }

  async mine(user: AuthenticatedUser) {
    const profile = await this.perfilDe(user.userId);
    const lista = await this.credentials.find({ where: { studentProfileId: profile.id }, order: { issuedAt: 'DESC' } });
    const vig = await this.vigencias(lista.map((c) => c.id));
    const pendientes = await this.eligibleFor(profile.id);
    const politica = await this.policy();
    return {
      policy: { enabled: politica.enabled, configured: politica.configured },
      items: lista.map((c) => this.vista(c, vig.get(c.id) ?? false)),
      pending: pendientes.map((p) => ({
        sourceType: p.sourceType, sourceLabel: SOURCE_LABEL[p.sourceType], title: this.nombreDeLogro(p), occurredAt: p.occurredAt,
      })),
    };
  }

  async list(params: { status?: string; q?: string; sourceType?: string; limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
    const offset = Math.max(Number(params.offset) || 0, 0);
    const qb = this.credentials.createQueryBuilder('v').orderBy('v.issued_at', 'DESC');
    if (params.sourceType) qb.andWhere('v.source_type = :st', { st: params.sourceType });
    if (params.q?.trim()) {
      qb.andWhere('(v.holder_name ILIKE :q OR v.achievement_name ILIKE :q OR v.public_code ILIKE :q)', { q: `%${params.q.trim().slice(0, 80)}%` });
    }
    if (params.status === 'revoked') qb.andWhere('v.revoked_at IS NOT NULL');
    if (params.status === 'suspended') qb.andWhere('v.revoked_at IS NULL AND v.suspended_at IS NOT NULL');
    const [filas, total] = await qb.take(limit).skip(offset).getManyAndCount();
    const vig = await this.vigencias(filas.map((f) => f.id));
    const nombres = await this.nombres(filas.flatMap((f) => [f.revokedBy, f.suspendedBy]));
    let items = filas.map((f) => this.vista(f, vig.get(f.id) ?? false, nombres));
    if (params.status === 'active' || params.status === 'without_effect') items = items.filter((i) => i.status === params.status);
    const [resumen] = await this.dataSource.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE revoked_at IS NOT NULL)::int AS revocados,
             count(*) FILTER (WHERE revoked_at IS NULL AND suspended_at IS NOT NULL)::int AS suspendidos
        FROM verifiable_credentials`);
    return { items, total, limit, offset, summary: resumen };
  }

  async detail(id: string) {
    const vc = await this.credentials.findOne({ where: { id } });
    if (!vc) throw new NotFoundException('Registro no encontrado.');
    const vigente = await this.fuenteVigente(this.dataSource, vc.sourceType, vc.sourceId);
    const nombres = await this.nombres([vc.revokedBy, vc.suspendedBy]);
    return { ...this.vista(vc, vigente, nombres), ledger: await this.ledger.forCode(vc.publicCode) };
  }

  /** El registro, si quien pide es su titular o Dirección. Para cualquier otro, «no existe». */
  async ownedOrDirector(user: AuthenticatedUser, id: string): Promise<VerifiableCredential> {
    const vc = await this.credentials.findOne({ where: { id } });
    if (!vc) throw new NotFoundException('Registro no encontrado.');
    if (user.role === RolNombre.CAREER_DIRECTOR) return vc;
    if (user.role === RolNombre.STUDENT) {
      const profile = await this.profiles.findOne({ where: { userId: user.userId } });
      if (profile?.id === vc.studentProfileId) return vc;
    }
    throw new NotFoundException('Registro no encontrado.');
  }

  findByCode(code: string): Promise<VerifiableCredential | null> {
    return this.credentials.findOne({ where: { publicCode: code } });
  }

  findByDocumentSha(sha: string): Promise<VerifiableCredential[]> {
    return this.credentials.find({ where: { documentSha256: sha }, take: 5 });
  }

  findByIds(ids: string[]): Promise<VerifiableCredential[]> {
    return ids.length ? this.credentials.find({ where: { id: In(ids) } }) : Promise.resolve([]);
  }

  // =====================================================================
  //  Formatos de salida
  // =====================================================================

  /** Hechos de un registro, leídos de lo firmado: una sola fuente de verdad. */
  factsOf(vc: VerifiableCredential): CredentialFacts & { narrative: string } {
    const subject = (vc.credentialJson.credentialSubject ?? {}) as Record<string, unknown>;
    const achievement = (subject.achievement ?? {}) as Record<string, unknown>;
    const narrative = String(((achievement.criteria ?? {}) as Record<string, unknown>).narrative ?? criteriaNarrative({
      sourceType: vc.sourceType, documentIssuer: vc.documentIssuer, activityTitle: null,
    }));
    return {
      code: vc.publicCode,
      sourceType: vc.sourceType,
      achievementName: vc.achievementName,
      activityTitle: null,
      holderName: vc.holderName,
      recipientHash: vc.recipientHash,
      recipientSalt: vc.recipientSalt,
      issuerName: vc.issuerName,
      documentIssuer: vc.documentIssuer,
      documentSha256: vc.documentSha256,
      occurredAt: vc.occurredAt,
      activityEndAt: subject.activityEndDate ? new Date(String(subject.activityEndDate)) : null,
      issuedAt: vc.issuedAt,
      statusIndex: vc.statusIndex,
      narrative,
    };
  }

  credentialJsonText(vc: VerifiableCredential): string {
    return JSON.stringify(vc.credentialJson, null, 2);
  }

  pdf(vc: VerifiableCredential): Buffer {
    const f = this.factsOf(vc);
    return renderRecordPdf({
      code: vc.publicCode,
      sourceType: vc.sourceType,
      achievementName: vc.achievementName,
      holderName: vc.holderName,
      issuerName: vc.issuerName,
      documentIssuer: vc.documentIssuer,
      documentSha256: vc.documentSha256,
      occurredAt: vc.occurredAt,
      issuedAt: vc.issuedAt,
      narrative: f.narrative,
      verifyUrl: paginaDeVerificacion(this.settings.webBase, vc.publicCode),
      payloadSha256: vc.payloadSha256,
      keyId: vc.keyId,
      credentialJson: JSON.stringify(vc.credentialJson),
    });
  }

  badgeSvg(vc: VerifiableCredential, horneado: boolean): string {
    return badgeSvg(
      { title: vc.achievementName, sourceType: vc.sourceType, code: vc.publicCode },
      horneado ? { credentialJson: JSON.stringify(vc.credentialJson) } : undefined,
    );
  }

  badgePng(vc: VerifiableCredential): Buffer {
    return bakedBadgePng(vc.sourceType, JSON.stringify(vc.credentialJson));
  }

  qrSvg(vc: VerifiableCredential): string {
    return qrToSvg(encodeQr(paginaDeVerificacion(this.settings.webBase, vc.publicCode))).replace('Código QR del perfil compartible', 'Código QR de verificación');
  }

  ob2Issuer() {
    return buildOb2Issuer(this.requireBases());
  }

  async ob2Badge(vc: VerifiableCredential) {
    return buildOb2BadgeClass(this.factsOf(vc), this.requireBases());
  }

  async ob2Assertion(vc: VerifiableCredential) {
    const vigente = await this.fuenteVigente(this.dataSource, vc.sourceType, vc.sourceId);
    const estado = this.effectiveStatus(vc, vigente);
    return buildOb2Assertion(this.factsOf(vc), this.requireBases(), {
      revoked: estado !== 'active',
      reason: estado === 'revoked' ? 'Revocado por la institución.'
        : estado === 'suspended' ? 'Suspendido por la institución.'
          : estado === 'without_effect' ? 'El hecho registrado ya no está vigente.' : null,
    });
  }

  // =====================================================================
  //  Integridad
  // =====================================================================

  /**
   * Auditoría completa: la cadena de la bitácora y, por cada registro, que
   * su firma verifique, que su huella sea la del contenido y que coincida con
   * la que quedó sellada en la bitácora al emitirlo.
   */
  async integrity() {
    const cadena = await this.ledger.verifyChain();
    const problemas: Array<{ code: string; problem: string }> = [];
    const sellos = new Map<string, string>();
    const emisiones: Array<{ public_code: string; payload: string }> = await this.dataSource.query(
      `SELECT public_code, data->>'payloadSha256' AS payload FROM credential_ledger WHERE event = 'ISSUED'`,
    );
    for (const e of emisiones) sellos.set(e.public_code, e.payload);
    let revisados = 0;
    let desde = 0;
    for (;;) {
      const lote = await this.credentials.find({ order: { createdAt: 'ASC' }, skip: desde, take: 200 });
      if (!lote.length) break;
      for (const vc of lote) {
        revisados += 1;
        const key = await this.keys.publicKey(vc.keyId);
        if (!key) problemas.push({ code: vc.publicCode, problem: 'La clave con la que se firmó no está registrada.' });
        else if (!verifyProof(vc.credentialJson, key).ok) problemas.push({ code: vc.publicCode, problem: 'La firma no verifica: el contenido fue alterado.' });
        if (sha256Hex(canonicalize(vc.credentialJson)) !== vc.payloadSha256) {
          problemas.push({ code: vc.publicCode, problem: 'La huella guardada no corresponde al contenido.' });
        }
        const sello = sellos.get(vc.publicCode);
        if (!sello) problemas.push({ code: vc.publicCode, problem: 'No hay entrada de emisión en la bitácora.' });
        else if (sello !== vc.payloadSha256) problemas.push({ code: vc.publicCode, problem: 'La huella no coincide con la sellada en la bitácora.' });
        if (problemas.length >= 100) break;
      }
      if (problemas.length >= 100 || lote.length < 200) break;
      desde += lote.length;
    }
    const resultado = {
      ok: cadena.ok && problemas.length === 0,
      ledger: cadena,
      credentialsChecked: revisados,
      problems: problemas,
      checkedAt: new Date().toISOString(),
    };
    if (!resultado.ok) this.logger.error(`Auditoría de credenciales con problemas: ${JSON.stringify(resultado.problems.slice(0, 5))}`);
    return resultado;
  }

  /** Para la verificación pública: la emisión sellada de un código. */
  async ledgerSeal(code: string) {
    const entradas = await this.ledger.forCode(code);
    const emision = entradas.find((e) => e.event === 'ISSUED') ?? null;
    return {
      issued: emision,
      entries: entradas,
      issuedEntryValid: emision ? await this.ledger.verifyEntry(emision) : false,
      head: await this.ledger.head(),
    };
  }

  async keyFor(kid: string) {
    return this.keys.publicKey(kid);
  }

  settingsSnapshot() {
    return this.settings;
  }
}
