import { createHash } from 'node:crypto';
import { CredentialSourceType } from '../entities/verifiable-credential.entity';
import { RUTAS, paginaDeVerificacion } from './credentials.config';

/**
 * Documentos de Open Badges 3.0 (1EdTech, sobre W3C VC Data Model 2.0) y de
 * Open Badges 2.0 alojado, construidos como objetos puros: sin base de datos
 * ni firma. Quien los usa decide cómo asegurarlos.
 */

export const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
export const OB3_CONTEXT = 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json';
export const OB2_CONTEXT = 'https://w3id.org/openbadges/v2';
export const OB3_SCHEMA = 'https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json';

/** `sha256$` + hex(SHA-256(identidad + sal)), la forma de Open Badges 2.0 y 3.0. */
export const hashIdentity = (identidad: string, sal: string): string =>
  `sha256$${createHash('sha256').update(identidad.trim().toLowerCase() + sal, 'utf8').digest('hex')}`;

export interface CredentialFacts {
  code: string;
  sourceType: CredentialSourceType;
  achievementName: string;
  activityTitle: string | null;
  holderName: string;
  recipientHash: string;
  recipientSalt: string;
  issuerName: string;
  documentIssuer: string | null;
  documentSha256: string | null;
  occurredAt: Date | null;
  activityEndAt: Date | null;
  issuedAt: Date;
  statusIndex: number;
}

export interface Bases {
  apiBase: string;
  webBase: string;
  issuerName: string;
}

export const issuerId = (b: Pick<Bases, 'apiBase'>) => `${b.apiBase}${RUTAS.issuer}`;
export const verificationMethodId = (b: Pick<Bases, 'apiBase'>, kid: string) => `${issuerId(b)}#${kid}`;

/** Qué afirma el registro, en palabras simples, según su origen. */
export function criteriaNarrative(f: Pick<CredentialFacts, 'sourceType' | 'documentIssuer' | 'activityTitle'>): string {
  const actividad = f.activityTitle ? `«${f.activityTitle}»` : 'la actividad';
  switch (f.sourceType) {
    case 'participation':
      return `El responsable de ${actividad} confirmó en Afinia la participación de la persona titular. `
        + 'Registra asistencia y participación, no una calificación ni una aprobación académica.';
    case 'institution_certificate':
      return `${f.documentIssuer ?? 'La institución'} emitió un certificado de ${actividad} y su responsable lo entregó `
        + 'a la persona titular por medio de Afinia. Afinia da fe de la entrega y de la huella del archivo; '
        + 'la autoría del certificado es de su emisor.';
    default:
      return `Constancia de ${actividad} registrada en Afinia antes de la versión 5. Se conserva como historia.`;
  }
}

export function achievementType(sourceType: CredentialSourceType): string {
  return sourceType === 'institution_certificate' ? 'Certificate' : 'Achievement';
}

/** La credencial Open Badges 3.0 sin firmar. */
export function buildOb3Credential(f: CredentialFacts, b: Bases): Record<string, unknown> {
  const id = `${b.apiBase}${RUTAS.credential(f.code)}`;
  const estado = (proposito: 'revocation' | 'suspension') => ({
    id: `${b.apiBase}${RUTAS.status(proposito)}#${f.statusIndex}`,
    type: 'BitstringStatusListEntry',
    statusPurpose: proposito,
    statusListIndex: String(f.statusIndex),
    statusListCredential: `${b.apiBase}${RUTAS.status(proposito)}`,
  });
  const subject: Record<string, unknown> = {
    type: ['AchievementSubject'],
    identifier: [
      { type: 'IdentityObject', identityType: 'emailAddress', hashed: true, identityHash: f.recipientHash, salt: f.recipientSalt },
      { type: 'IdentityObject', identityType: 'name', hashed: false, identityHash: f.holderName },
    ],
    achievement: {
      id: `${id}#achievement`,
      type: ['Achievement'],
      achievementType: achievementType(f.sourceType),
      name: f.achievementName,
      description: criteriaNarrative(f),
      criteria: { narrative: criteriaNarrative(f) },
      image: { id: `${b.apiBase}${RUTAS.ob2BadgeImage(f.code)}`, type: 'Image' },
    },
  };
  if (f.occurredAt) subject.activityStartDate = f.occurredAt.toISOString();
  if (f.activityEndAt) subject.activityEndDate = f.activityEndAt.toISOString();

  const credential: Record<string, unknown> = {
    '@context': [VC_V2_CONTEXT, OB3_CONTEXT],
    id,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name: f.achievementName,
    description: 'Registro verificable emitido por Afinia. No reemplaza a los certificados oficiales de la universidad.',
    issuer: { id: issuerId(b), type: ['Profile'], name: b.issuerName, url: b.webBase },
    validFrom: f.issuedAt.toISOString(),
    credentialSubject: subject,
    credentialStatus: [estado('revocation'), estado('suspension')],
    credentialSchema: [{ id: OB3_SCHEMA, type: '1EdTechJsonSchemaValidator2019' }],
  };
  if (f.documentSha256) {
    credential.evidence = [{
      id: `${paginaDeVerificacion(b.webBase, f.code)}#documento`,
      type: ['Evidence'],
      name: `Certificado entregado${f.documentIssuer ? ` (emisor: ${f.documentIssuer})` : ''}`,
      description: `SHA-256 del archivo entregado: ${f.documentSha256}`,
    }];
  }
  return credential;
}

/** Perfil del emisor (OB 3.0) con sus claves Multikey. */
export function buildIssuerProfile(b: Bases, keys: { id: string; publicKeyMultibase: string }[]): Record<string, unknown> {
  const id = issuerId(b);
  const metodos = keys.map((k) => ({
    id: verificationMethodId(b, k.id),
    type: 'Multikey',
    controller: id,
    publicKeyMultibase: k.publicKeyMultibase,
  }));
  return {
    '@context': [VC_V2_CONTEXT, OB3_CONTEXT, 'https://w3id.org/security/multikey/v1'],
    id,
    type: ['Profile'],
    name: b.issuerName,
    url: b.webBase,
    description: 'Afinia firma registros verificables de lo que el sistema registró. No emite títulos ni certificados académicos.',
    verificationMethod: metodos,
    assertionMethod: metodos.map((m) => m.id),
  };
}

export function buildStatusListCredential(
  b: Bases,
  proposito: 'revocation' | 'suspension',
  encodedList: string,
  validFrom: Date,
): Record<string, unknown> {
  const id = `${b.apiBase}${RUTAS.status(proposito)}`;
  return {
    '@context': [VC_V2_CONTEXT],
    id,
    type: ['VerifiableCredential', 'BitstringStatusListCredential'],
    issuer: issuerId(b),
    validFrom: validFrom.toISOString(),
    credentialSubject: { id: `${id}#list`, type: 'BitstringStatusList', statusPurpose: proposito, encodedList },
  };
}

// ---------------------------------------------------------------- OB 2.0

export function buildOb2Issuer(b: Bases): Record<string, unknown> {
  return {
    '@context': OB2_CONTEXT,
    type: 'Issuer',
    id: `${b.apiBase}${RUTAS.ob2Issuer}`,
    name: b.issuerName,
    url: b.webBase,
    description: 'Afinia firma registros verificables de lo que el sistema registró. No emite títulos ni certificados académicos.',
  };
}

export function buildOb2BadgeClass(f: CredentialFacts, b: Bases): Record<string, unknown> {
  return {
    '@context': OB2_CONTEXT,
    type: 'BadgeClass',
    id: `${b.apiBase}${RUTAS.ob2Badge(f.code)}`,
    name: f.achievementName,
    description: criteriaNarrative(f),
    image: `${b.apiBase}${RUTAS.ob2BadgeImage(f.code)}`,
    criteria: { narrative: criteriaNarrative(f) },
    issuer: `${b.apiBase}${RUTAS.ob2Issuer}`,
  };
}

export function buildOb2Assertion(
  f: CredentialFacts,
  b: Bases,
  estado: { revoked: boolean; reason: string | null },
): Record<string, unknown> {
  const assertion: Record<string, unknown> = {
    '@context': OB2_CONTEXT,
    type: 'Assertion',
    id: `${b.apiBase}${RUTAS.ob2Assertion(f.code)}`,
    recipient: { type: 'email', hashed: true, salt: f.recipientSalt, identity: f.recipientHash },
    badge: `${b.apiBase}${RUTAS.ob2Badge(f.code)}`,
    issuedOn: f.issuedAt.toISOString(),
    verification: { type: 'hosted' },
    evidence: paginaDeVerificacion(b.webBase, f.code),
  };
  if (estado.revoked) {
    assertion.revoked = true;
    if (estado.reason) assertion.revocationReason = estado.reason;
  }
  return assertion;
}

/** Enlace «Agregar a mi perfil de LinkedIn» (sección Licencias y certificaciones). */
export function linkedInAddUrl(f: Pick<CredentialFacts, 'code' | 'achievementName' | 'issuedAt'>, b: Bases): string {
  const p = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: f.achievementName.slice(0, 100),
    organizationName: b.issuerName.slice(0, 100),
    issueYear: String(f.issuedAt.getUTCFullYear()),
    issueMonth: String(f.issuedAt.getUTCMonth() + 1),
    certUrl: paginaDeVerificacion(b.webBase, f.code),
    certId: f.code,
  });
  return `https://www.linkedin.com/profile/add?${p.toString()}`;
}
