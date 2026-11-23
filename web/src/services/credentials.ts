import { api } from '../api/client';

/** V8 · Registros verificables (Open Badges 3.0 / 2.0). */

export type CredentialStatus = 'active' | 'suspended' | 'without_effect' | 'revoked';
export type CredentialSourceType = 'participation' | 'institution_certificate' | 'internal_constancy';

export interface VerifiableCredentialItem {
  id: string;
  code: string;
  sourceType: CredentialSourceType;
  sourceLabel: string;
  achievementName: string;
  holderName: string;
  issuerName: string;
  documentIssuer: string | null;
  documentSha256: string | null;
  activityId: string | null;
  occurredAt: string | null;
  issuedAt: string;
  status: CredentialStatus;
  sourceValid: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  revokedBy?: string | null;
  suspendedBy?: string | null;
  payloadSha256: string;
  keyId: string;
  verifyUrl: string;
  linkedInUrl: string | null;
  ob2AssertionUrl: string | null;
  ob3Url: string | null;
}

export interface MyCredentials {
  policy: { enabled: boolean; configured: boolean };
  items: VerifiableCredentialItem[];
  pending: { sourceType: CredentialSourceType; sourceLabel: string; title: string; occurredAt: string | null }[];
}

export interface CredentialPolicy {
  enabled: boolean;
  decidedAt: string | null;
  decidedBy: string | null;
  justification: string | null;
  configured: boolean;
  history: { enabled: boolean; justification: string; decidedAt: string; decidedBy: string | null }[];
}

export interface LedgerEvent {
  seq: string;
  event: string;
  createdAt: string;
  entryHash: string;
  prevHash: string;
}

export interface IntegrityReport {
  ok: boolean;
  ledger: { ok: boolean; entries: number; head: { seq: string; hash: string; at: string } | null; brokenAt: { seq: string; reason: string } | null };
  credentialsChecked: number;
  problems: { code: string; problem: string }[];
  checkedAt: string;
}

export type Outcome =
  | 'valid' | 'revoked' | 'suspended' | 'without_effect' | 'invalid' | 'altered' | 'not_found'
  | 'valid_external' | 'unverifiable' | 'expired' | 'document_recognized';

export interface VerificationCheck {
  id: string;
  label: string;
  status: 'ok' | 'fail' | 'warn' | 'skip';
  detail: string;
}

export interface VerificationReport {
  outcome: Outcome;
  title: string;
  summary: string;
  checks: VerificationCheck[];
  credential: Record<string, unknown> | null;
  ledger: {
    seq: string | null;
    entryHash: string | null;
    events: { seq: string; event: string; at: string; hash: string }[];
    head: { seq: string; hash: string; at: string } | null;
  } | null;
  links: Record<string, string> | null;
  file: Record<string, unknown> | null;
  checkedAt: string;
}

export interface BatchResult {
  results: { input: string; outcome: Outcome; title: string; holderName: string | null; achievementName: string | null; code: string | null }[];
  summary: { total: number; valid: number; problems: number };
}

export type DownloadFormat = 'pdf' | 'json' | 'jwt' | 'svg' | 'png' | 'qr';

export const credentialService = {
  mine: () => api.get<MyCredentials>('/credentials/mine').then((r) => r.data),
  issueMine: () => api.post<{ issued: number; items: MyCredentials }>('/credentials/mine/issue').then((r) => r.data),
  download: (id: string, format: DownloadFormat) =>
    api.get<Blob>(`/credentials/${id}/download/${format}`, { responseType: 'blob' }).then((r) => r.data),

  policy: () => api.get<CredentialPolicy>('/credentials/policy').then((r) => r.data),
  setPolicy: (enabled: boolean, justification: string) =>
    api.post<CredentialPolicy>('/credentials/policy', { enabled, justification }).then((r) => r.data),
  registry: (params: { status?: string; q?: string; sourceType?: string; limit?: number; offset?: number }) =>
    api.get<{ items: VerifiableCredentialItem[]; total: number; summary: { total: number; revocados: number; suspendidos: number } }>(
      '/credentials/registry', { params },
    ).then((r) => r.data),
  detail: (id: string) =>
    api.get<VerifiableCredentialItem & { ledger: LedgerEvent[] }>(`/credentials/registry/${id}`).then((r) => r.data),
  issuePending: (activityId?: string) =>
    api.post<{ issued: number; students: number }>('/credentials/registry/issue-pending', activityId ? { activityId } : {}).then((r) => r.data),
  integrity: () => api.get<IntegrityReport>('/credentials/registry/integrity').then((r) => r.data),
  suspend: (id: string, reason: string) =>
    api.post<VerifiableCredentialItem>(`/credentials/registry/${id}/suspend`, { reason }).then((r) => r.data),
  lift: (id: string, reason: string) =>
    api.post<VerifiableCredentialItem>(`/credentials/registry/${id}/lift`, { reason }).then((r) => r.data),
  revoke: (id: string, reason: string) =>
    api.post<VerifiableCredentialItem>(`/credentials/registry/${id}/revoke`, { reason }).then((r) => r.data),
};

/** Verificación pública: no necesita sesión. */
export const publicCredentialService = {
  byCode: (code: string) =>
    api.get<VerificationReport>(`/public/credentials/${encodeURIComponent(code)}`).then((r) => r.data),
  presented: (credential: unknown) =>
    api.post<VerificationReport>('/public/credentials/verify', { credential }).then((r) => r.data),
  file: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<VerificationReport>('/public/credentials/verify-file', fd).then((r) => r.data);
  },
  batch: (codes: string[]) =>
    api.post<BatchResult>('/public/credentials/verify-batch', { codes }).then((r) => r.data),
};

/** Guarda un blob como archivo. */
export function guardarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const ESTADO_REGISTRO: Record<CredentialStatus, { label: string; tone: string }> = {
  active: { label: 'Vigente', tone: 'green' },
  suspended: { label: 'Suspendido', tone: 'amber' },
  without_effect: { label: 'Sin efecto', tone: 'gray' },
  revoked: { label: 'Revocado', tone: 'red' },
};
