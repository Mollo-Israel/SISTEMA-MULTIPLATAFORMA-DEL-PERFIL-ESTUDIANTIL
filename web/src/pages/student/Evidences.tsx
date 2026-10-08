import { validarFormulario } from '../../components/form';
import { useEffect, useRef, useState } from 'react';
import {
  FiUpload, FiLink, FiFile, FiTrash2, FiExternalLink, FiAward, FiSearch,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  catalogService,
  certificateService,
  constancyService,
  evidenceService,
  uploadService,
  validationService,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, Loading, PageHeader, ResultCount,
  SearchInput, SkeletonTable,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
import {
  BACKING_TIER_HELP,
  BACKING_TIER_LABEL,
  CREDENTIAL_CHECK_LABEL,
  CREDENTIAL_CONTRADICTION_LABEL,
  LINK_CHECK_LABEL,
} from '../../services/types';
import type {
  AcademicArea,
  Evidence,
  ExternalCertificate,
  CredentialOpportunity,
  Skill,
  StoredFile,
  ValidationVerdict,
} from '../../services/types';

/** §27.3: máximo por archivo. */
const MAX_MB = 10;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';

const humanSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function StudentEvidencesPage() {
  const evidences = useAsync<Evidence[]>(() => evidenceService.mine(), []);
  const certificates = useAsync<ExternalCertificate[]>(() => certificateService.mine(), []);
  const constancies = useAsync(() => constancyService.mine(), []);

  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [evidenceQuery, setEvidenceQuery] = useState('');
  const [certificateQuery, setCertificateQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    catalogService.areas().then(setAreas).catch(() => {});
  }, []);

  const notify = (t: string) => toast.success(t);

  const confirm = useConfirm();

  const removeEvidence = async (e: Evidence) => {
    const ok = await confirm({
      title: 'Eliminar evidencia',
      message: 'Se eliminará la evidencia y su archivo. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await evidenceService.remove(e.id);
      notify('Evidencia eliminada.');
      evidences.reload();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  const removeCertificate = async (c: ExternalCertificate) => {
    const ok = await confirm({
      title: 'Eliminar certificado',
      message: `Se eliminará “${c.certificateName}” y su archivo. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await certificateService.remove(c.id);
      notify('Certificado eliminado.');
      certificates.reload();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <div>
      <PageHeader
        title="Credenciales y constancias"
        description="Tus credenciales externas y las constancias internas que recibiste. Afinia no las certifica: las valida por niveles y lo indica en cada una."
      />

      {/* V3 §23: ya no hay una bandeja genérica de evidencias. Las de un
          proyecto se agregan dentro del proyecto. Las registradas antes se
          conservan aquí, sin borrar datos. */}
      <p className="inline-note">
        Las evidencias de un proyecto (capturas, documentación, repositorio, demo) se agregan dentro de cada proyecto, en «Proyectos».
      </p>

      <Card
        title="Evidencias registradas antes"
        actions={
          <SearchInput
            value={evidenceQuery}
            onChange={setEvidenceQuery}
            placeholder="Buscar evidencia…"
          />
        }
      >
        <AsyncView
          loading={evidences.loading}
          error={evidences.error}
          data={evidences.data}
          skeleton={<SkeletonTable rows={4} columns={3} />}
          isEmpty={(d) => d.length === 0}
          emptyMessage="Todavía no registras evidencias. Usa el formulario de arriba para agregar la primera."
        >
          {(all) => {
            const q = normalize(evidenceQuery.trim());
            const rows = q
              ? all.filter((e) =>
                  [e.description ?? '', e.fileName ?? '', e.project?.title ?? '',
                   e.activity?.title ?? '', e.academicArea?.name ?? '']
                    .some((f) => normalize(f).includes(q)),
                )
              : all;
            if (rows.length === 0) {
              return (
                <EmptyState
                  icon={<FiSearch size={22} />}
                  message={`Ninguna evidencia coincide con “${evidenceQuery}”.`}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setEvidenceQuery('')}>
                      Limpiar búsqueda
                    </Button>
                  }
                />
              );
            }
            return (
            <>
            <div className="flex between" style={{ marginBottom: '0.6rem' }}>
              <ResultCount shown={rows.length} total={all.length} noun="evidencias" />
            </div>
            <div className="evidence-list">
              {rows.map((e) => (
                <div key={e.id} className="evidence-item">
                  <div className={`ev-icon ${e.evidenceType}`}>
                    {e.evidenceType === 'file' ? <FiFile /> : <FiLink />}
                  </div>
                  <div className="grow">
                    <strong>{e.description || (e.evidenceType === 'file' ? e.fileName : 'Enlace')}</strong>
                    <div className="activity-meta">
                      {e.project && <span>Proyecto: {e.project.title}</span>}
                      {e.activity && <span>Actividad: {e.activity.title}</span>}
                      {e.academicArea && <span>Área: {e.academicArea.name}</span>}
                      {e.evidenceType === 'file' && e.fileSize && (
                        <span>
                          {e.fileName} · {humanSize(e.fileSize)}
                        </span>
                      )}
                      <span>
                        {new Date(e.createdAt).toLocaleDateString('es-BO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex" style={{ gap: '0.35rem' }}>
                    <a
                      className="btn btn-secondary btn-sm"
                      href={
                        e.evidenceType === 'file'
                          ? uploadService.fileUrl(e.fileUrl ?? '')
                          : (e.externalUrl ?? '#')
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FiExternalLink /> Abrir
                    </a>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => removeEvidence(e)}
                      title="Eliminar evidencia"
                      aria-label="Eliminar evidencia"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
            );
          }}
        </AsyncView>
      </Card>

      <CertificateForm
        areas={areas}
        onError={(m) => toast.error(m)}
        onSaved={() => {
          notify('Certificado registrado.');
          certificates.reload();
        }}
      />

      <Card
        title="Mis certificados externos"
        actions={
          <SearchInput
            value={certificateQuery}
            onChange={setCertificateQuery}
            placeholder="Buscar certificado o emisor…"
          />
        }
      >
        <AsyncView
          loading={certificates.loading}
          error={certificates.error}
          data={certificates.data}
          skeleton={<SkeletonTable rows={3} columns={5} />}
          isEmpty={(d) => d.length === 0}
          emptyMessage="Todavía no registras certificados externos."
        >
          {(allCerts) => {
            const q = normalize(certificateQuery.trim());
            const rows = q
              ? allCerts.filter((c) =>
                  [c.certificateName, c.issuer, c.academicArea?.name ?? '', c.description ?? '']
                    .some((f) => normalize(f).includes(q)),
                )
              : allCerts;
            if (rows.length === 0) {
              return (
                <EmptyState
                  icon={<FiSearch size={22} />}
                  message={`Ningún certificado coincide con “${certificateQuery}”.`}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setCertificateQuery('')}>
                      Limpiar búsqueda
                    </Button>
                  }
                />
              );
            }
            return (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Certificado</th>
                    <th>Emisor</th>
                    <th>Área</th>
                    <th>Emisión</th>
                    <th>Adjunto</th>
                    <th>Respaldo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.certificateName}</strong>
                        <div className="muted small">
                          {c.source === 'opportunity' && c.activity
                            ? `De la oportunidad «${c.activity.title}»`
                            : 'Histórica'}
                        </div>
                        {c.description && <div className="muted">{c.description}</div>}
                        {(c.skills ?? []).length > 0 && (
                          <div className="muted small">
                            {(c.skills ?? []).map((s) => s.skill?.name).filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="muted">{c.issuer}</td>
                      <td className="muted">{c.academicArea?.name ?? '—'}</td>
                      <td className="muted">{c.issueDate ?? '—'}</td>
                      <td>
                        {c.fileUrl ? (
                          <a
                            className="btn btn-secondary btn-sm"
                            href={uploadService.fileUrl(c.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FiFile /> Ver
                          </a>
                        ) : c.certificateUrl ? (
                          <a
                            className="btn btn-secondary btn-sm"
                            href={c.certificateUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FiLink /> Enlace
                          </a>
                        ) : (
                          <span className="muted">Sin adjunto</span>
                        )}
                      </td>
                      <td>
                        <RespaldoDelCertificado certificateId={c.id} />
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => removeCertificate(c)}
                          title="Eliminar certificado"
                          aria-label="Eliminar certificado"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          }}
        </AsyncView>
      </Card>

      <Card title="Constancias internas recibidas">
        <p className="muted" style={{ marginBottom: '0.7rem' }}>
          Las emite la dirección de carrera cuando tu participación en una actividad queda
          confirmada. No sustituyen a un certificado oficial de la universidad.
        </p>
        <AsyncView
          loading={constancies.loading}
          error={constancies.error}
          data={constancies.data}
          skeleton={<SkeletonTable rows={2} columns={3} />}
          isEmpty={(d: any) => d.length === 0}
          emptyMessage="Todavía no recibes constancias internas."
        >
          {(rows: any) => (
            <div className="evidence-list">
              {rows.map((c: any) => (
                <div key={c.id} className="evidence-item">
                  <div className="ev-icon constancy">
                    <FiAward />
                  </div>
                  <div className="grow">
                    <strong>{c.description}</strong>
                    <div className="activity-meta">
                      {c.activity && <span>Actividad: {c.activity.title}</span>}
                      <span>
                        {new Date(c.createdAt).toLocaleDateString('es-BO', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <Badge tone="green">Autorizada</Badge>
                </div>
              ))}
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilePicker({
  file,
  onPicked,
  onError,
  label = 'Archivo',
}: {
  file: StoredFile | null;
  onPicked: (f: StoredFile | null) => void;
  onError: (msg: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_MB * 1024 * 1024) {
      onError(`El archivo supera el máximo de ${MAX_MB} MB.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setBusy(true);
    try {
      const subido = await uploadService.upload(selected);
      onPicked(subido);
      // §28: no se impide, se avisa. El mismo documento puede respaldar
      // legítimamente dos cosas; lo que no hará es contar dos veces.
      if (subido.duplicateOfId) {
        onError('Ya habías subido este mismo archivo. Puedes usarlo igual, pero no sumará respaldo por separado.');
      }
    } catch (e2) {
      onError(apiError(e2, 'No se pudo subir el archivo.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label htmlFor="evidences-campo">{label}</label>
      <input id="evidences-campo" ref={inputRef} type="file" accept={ACCEPT} onChange={pick} disabled={busy} />
      <span className="muted" style={{ fontSize: '0.76rem' }}>
        PDF, PNG, JPG o WEBP · máximo {MAX_MB} MB
      </span>
      {busy && <Loading label="Subiendo archivo…" />}
      {file && (
        <div className="file-chip">
          <FiFile /> {file.originalFilename} · {humanSize(file.sizeBytes)}
          {file.duplicateOfId && (
            <Badge tone="amber">Ya lo habías subido</Badge>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onPicked(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            Quitar
          </button>
        </div>
      )}
    </div>
  );
}
function CertificateForm({
  areas,
  onSaved,
  onError,
}: {
  areas: AcademicArea[];
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({
    certificateName: '',
    issuer: '',
    issueDate: '',
    description: '',
    academicAreaId: '',
    certificateUrl: '',
    credentialId: '',
  });
  // V3 §15/§16: viene de una oportunidad terminada en la que participó, o
  // es histórica (anterior a Afinia o de algo que no pasó por aquí).
  const [oportunidades, setOportunidades] = useState<CredentialOpportunity[]>([]);
  const [activityId, setActivityId] = useState('');
  useEffect(() => {
    certificateService.eligibleOpportunities().then(setOportunidades).catch(() => setOportunidades([]));
  }, []);
  const elegirOportunidad = (id: string) => {
    setActivityId(id);
    const o = oportunidades.find((x) => x.activityId === id);
    if (o) {
      setForm((f) => ({
        ...f,
        certificateName: f.certificateName || o.expectedCourseName || o.title,
        issuer: f.issuer || o.provider || '',
      }));
    }
  };
  const [file, setFile] = useState<StoredFile | null>(null);
  const [saving, setSaving] = useState(false);
  // V2 §41: tecnologías que el certificado acredita, del catálogo.
  const [catalogo, setCatalogo] = useState<Skill[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState('');
  useEffect(() => {
    catalogService.skills().then((s) => setCatalogo(s.filter((x) => x.isActive !== false))).catch(() => {});
  }, []);
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sugeridas = busqueda.trim().length < 2 ? [] : catalogo
    .filter((s) => !skillIds.includes(s.id))
    .filter((s) => [s.name, ...(s.aliases ?? [])].some((n) => norm(n).includes(norm(busqueda.trim()))))
    .slice(0, 12);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await certificateService.create({
        certificateName: form.certificateName,
        issuer: form.issuer,
        issueDate: form.issueDate || undefined,
        description: form.description || undefined,
        academicAreaId: form.academicAreaId || undefined,
        certificateUrl: form.certificateUrl || undefined,
        credentialId: form.credentialId || undefined,
        storedFileId: file?.id,
        skillIds: skillIds.length ? skillIds : undefined,
        activityId: activityId || undefined,
      });
      setForm({
        certificateName: '',
        issuer: '',
        issueDate: '',
        description: '',
        academicAreaId: '',
        certificateUrl: '',
        credentialId: '',
      });
      setFile(null);
      setSkillIds([]);
      setBusqueda('');
      setActivityId('');
      certificateService.eligibleOpportunities().then(setOportunidades).catch(() => {});
      onSaved();
    } catch (e2) {
      onError(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Adjuntar credencial externa">
      <form noValidate onSubmit={submit}>
        <div className="field">
          <label htmlFor="cert-origen">¿De dónde viene?</label>
          <select id="cert-origen" value={activityId} onChange={(e) => elegirOportunidad(e.target.value)}>
            <option value="">Histórica: la obtuve antes o fuera de Afinia</option>
            {oportunidades.map((o) => (
              <option key={o.activityId} value={o.activityId}>
                {o.title}{o.provider ? ` · ${o.provider}` : ''}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {oportunidades.length
              ? 'Aparecen las oportunidades terminadas en las que fuiste aceptado o confirmado.'
              : 'Cuando termine una oportunidad externa en la que te acepten, aparecerá aquí.'}
          </span>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="cert-nombre">Nombre del certificado</label>
            <input
              id="cert-nombre"
              value={form.certificateName}
              onChange={(e) => setForm({ ...form, certificateName: e.target.value })}
              placeholder="Fundamentos de pruebas automatizadas"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cert-emisor">Entidad emisora</label>
            <input
              id="cert-emisor"
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              placeholder="Plataforma externa de formación"
              required
            />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="evidences-fecha-de-emision">Fecha de emisión</label>
            <input id="evidences-fecha-de-emision"
              type="date"
              value={form.issueDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="evidences-area-academica-2">Área académica</label>
            <select id="evidences-area-academica-2"
              value={form.academicAreaId}
              onChange={(e) => setForm({ ...form, academicAreaId: e.target.value })}
            >
              <option value="">Sin área</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="evidences-descripcion-2">Descripción</label>
          <input id="evidences-descripcion-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Curso de 40 horas con evaluación final"
            maxLength={300}
          />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="evidences-enlace-de-verificacion-opcional">Enlace de verificación (opcional)</label>
            <input id="evidences-enlace-de-verificacion-opcional"
              type="url"
              value={form.certificateUrl}
              onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })}
              placeholder="https://emisor.example.com/cert/123"
            />
            <span className="field-hint">
              Si el emisor publica una página para verificar el certificado, este es el
              dato que más lo respalda.
            </span>
          </div>
          <div className="field">
            <label htmlFor="evidences-codigo-de-credencial-opcional">Código de credencial (opcional)</label>
            <input id="evidences-codigo-de-credencial-opcional"
              value={form.credentialId}
              onChange={(e) => setForm({ ...form, credentialId: e.target.value })}
              placeholder="AF-2026-00417"
              maxLength={80}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="cert-skills">Tecnologías que acredita (opcional)</label>
          {skillIds.length > 0 && (
            <div className="chip-row" style={{ marginBottom: '0.4rem' }}>
              {skillIds.map((id) => (
                <button
                  type="button"
                  key={id}
                  className="chip on"
                  aria-label={`Quitar ${catalogo.find((s) => s.id === id)?.name ?? 'tecnología'}`}
                  onClick={() => setSkillIds(skillIds.filter((x) => x !== id))}
                >
                  {catalogo.find((s) => s.id === id)?.name ?? id} ×
                </button>
              ))}
            </div>
          )}
          <input
            id="cert-skills"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Escribe para buscar: React, Docker, SQL…"
          />
          {sugeridas.length > 0 && (
            <div className="chip-row" style={{ marginTop: '0.4rem' }}>
              {sugeridas.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="chip"
                  onClick={() => { setSkillIds([...skillIds, s.id].slice(0, 15)); setBusqueda(''); }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <span className="field-hint">
            Cuentan como tecnologías respaldadas solo si el certificado queda con respaldo.
          </span>
        </div>
        <FilePicker
          file={file}
          onPicked={setFile}
          onError={onError}
          label="Archivo del certificado (opcional)"
        />
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Adjuntar credencial'}
        </button>
      </form>
    </Card>
  );
}

/**
 * Nivel de respaldo de un certificado (§30).
 *
 * Se consulta por separado porque la validación es asíncrona: el certificado
 * existe desde que se registra y su veredicto llega cuando llega. Mientras
 * tanto se dice «comprobando», que es la verdad.
 *
 * El texto evita cualquier palabra que suene a autenticidad legal: esto mide
 * qué pudo corroborarse técnicamente, nada más.
 */
function RespaldoDelCertificado({ certificateId }: { certificateId: string }) {
  const [verdict, setVerdict] = useState<ValidationVerdict | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pidiendo, setPidiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    validationService
      .forResource('external_certificate', certificateId)
      .then((v) => { if (vivo) setVerdict(v); })
      .catch(() => { /* sin veredicto todavía */ })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [certificateId]);

  if (cargando) return <span className="muted" style={{ fontSize: '0.76rem' }}>Comprobando…</span>;
  if (!verdict) return <span className="muted" style={{ fontSize: '0.76rem' }}>Sin comprobar</span>;

  if (verdict.status === 'pending' || verdict.status === 'processing') {
    return <Badge tone="gray">En cola</Badge>;
  }

  const tono = verdict.backingTier === 'corroborated'
    ? 'green'
    : verdict.backingTier === 'supported'
      ? 'bordo'
      : verdict.backingTier === 'flagged' ? 'red' : 'gray';
  const chequeo = verdict.credentialCheck;
  const revision = verdict.manualReview;

  const pedirRevision = async () => {
    const nota = window.prompt(
      'Cuéntale a Dirección cómo puede comprobar esta credencial (opcional):',
      '',
    );
    if (nota === null) return;
    setPidiendo(true);
    try {
      await certificateService.requestManualReview(certificateId, nota.trim());
      setVerdict(await validationService.forResource('external_certificate', certificateId));
    } catch (e) {
      window.alert(apiError(e));
    } finally {
      setPidiendo(false);
    }
  };

  return (
    <div className="respaldo">
      <Badge tone={tono}>{BACKING_TIER_LABEL[verdict.backingTier]}</Badge>
      <span className="muted">{BACKING_TIER_HELP[verdict.backingTier]}</span>
      {chequeo && (
        <span className="muted">
          Verificación: {CREDENTIAL_CHECK_LABEL[chequeo.status].toLowerCase()}
          {chequeo.qr === 'qr_present' ? ' · QR leído' : ''}
        </span>
      )}
      {chequeo && chequeo.contradictions.length > 0 && (
        <span className="respaldo-aviso">
          {chequeo.contradictions.map((c) => CREDENTIAL_CONTRADICTION_LABEL[c] ?? c).join('; ')}.
        </span>
      )}
      {revision?.status === 'requested' && <span className="muted">Revisión excepcional pedida a Dirección.</span>}
      {revision?.status === 'corroborated' && <span className="muted">Corroborada por revisión de Dirección.</span>}
      {revision?.status === 'not_corroborated' && (
        <span className="muted">Dirección no pudo corroborarla: {revision.reason}</span>
      )}
      {revision?.canRequest && (
        <button type="button" className="link-button" disabled={pidiendo} onClick={pedirRevision}>
          {pidiendo ? 'Enviando…' : 'Pedir revisión excepcional'}
        </button>
      )}

      {verdict.identityMatchStatus === 'mismatch' && (
        <span className="respaldo-aviso">
          El nombre del documento no corresponde al tuyo.
        </span>
      )}
      {verdict.status === 'inconclusive' && (
        <span className="muted">
          No se pudo leer el documento. Sigue registrado; añade el enlace de
          verificación del emisor si lo tienes.
        </span>
      )}
      {verdict.isDuplicate && (
        <span className="muted">Este mismo archivo ya respalda otro registro tuyo.</span>
      )}
      {verdict.linkCheck && verdict.linkCheck.status !== 'unverified' && (
        <span className="muted">
          Enlace: {LINK_CHECK_LABEL[verdict.linkCheck.status].toLowerCase()}
        </span>
      )}
    </div>
  );
}
