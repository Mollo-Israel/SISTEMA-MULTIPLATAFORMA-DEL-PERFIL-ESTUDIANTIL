import { useEffect, useRef, useState } from 'react';
import {
  FiUpload, FiLink, FiFile, FiTrash2, FiExternalLink, FiAward, FiSearch,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  activityService,
  catalogService,
  certificateService,
  constancyService,
  evidenceService,
  projectService,
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
  LINK_CHECK_LABEL,
} from '../../services/types';
import type {
  AcademicArea,
  Activity,
  Evidence,
  ExternalCertificate,
  Project,
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [evidenceQuery, setEvidenceQuery] = useState('');
  const [certificateQuery, setCertificateQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    catalogService.areas().then(setAreas).catch(() => {});
    projectService.mine().then(setProjects).catch(() => {});
    activityService
      .myRegistrations()
      .then((rows) => setActivities(rows.map((r) => r.activity).filter(Boolean)))
      .catch(() => {});
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
        title="Evidencias y certificados"
        description="Respalda tu trayectoria con enlaces o archivos. Los certificados externos se registran como evidencia: el sistema no los certifica ni los valida oficialmente."
      />

      <EvidenceForm
        areas={areas}
        projects={projects}
        activities={activities}
        onError={(m) => toast.error(m)}
        onSaved={() => {
          notify('Evidencia registrada.');
          evidences.reload();
        }}
      />

      <Card
        title="Mis evidencias"
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
                        {c.description && <div className="muted">{c.description}</div>}
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
      <label>{label}</label>
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={pick} disabled={busy} />
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

function EvidenceForm({
  areas,
  projects,
  activities,
  onSaved,
  onError,
}: {
  areas: AcademicArea[];
  projects: Project[];
  activities: Activity[];
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [type, setType] = useState<'link' | 'file'>('link');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<StoredFile | null>(null);
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [academicAreaId, setAcademicAreaId] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'file' && !file) {
      onError('Selecciona un archivo antes de guardar la evidencia.');
      return;
    }
    setSaving(true);
    try {
      await evidenceService.create({
        evidenceType: type,
        description: description || undefined,
        externalUrl: type === 'link' ? externalUrl : undefined,
        // §27: se envía el identificador del archivo. Los metadatos los
        // resuelve el servidor a partir de lo que realmente se subió.
        storedFileId: type === 'file' ? file?.id : undefined,
        projectId: projectId || undefined,
        activityId: activityId || undefined,
        academicAreaId: academicAreaId || undefined,
      });
      setDescription('');
      setExternalUrl('');
      setFile(null);
      setProjectId('');
      setActivityId('');
      setAcademicAreaId('');
      onSaved();
    } catch (e2) {
      onError(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Registrar evidencia">
      <form onSubmit={submit}>
        <div className="type-toggle">
          <button
            type="button"
            className={type === 'link' ? 'on' : ''}
            onClick={() => setType('link')}
          >
            <FiLink /> Enlace
          </button>
          <button
            type="button"
            className={type === 'file' ? 'on' : ''}
            onClick={() => setType('file')}
          >
            <FiUpload /> Archivo
          </button>
        </div>

        <div className="field">
          <label>Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Certificado de asistencia al taller"
            maxLength={300}
          />
        </div>

        {type === 'link' ? (
          <div className="field">
            <label>Enlace</label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://github.com/usuario/proyecto"
              required
            />
          </div>
        ) : (
          <FilePicker file={file} onPicked={setFile} onError={onError} />
        )}

        <p className="muted" style={{ fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          Asocia la evidencia a lo que respalda. Puedes dejar los tres campos vacíos si es una
          evidencia general.
        </p>

        <div className="row">
          <div className="field">
            <label>Proyecto</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Ninguno</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Actividad</label>
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              <option value="">Ninguna</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <span className="muted" style={{ fontSize: '0.74rem' }}>
              Solo actividades en las que participas.
            </span>
          </div>
          <div className="field">
            <label>Área académica</label>
            <select value={academicAreaId} onChange={(e) => setAcademicAreaId(e.target.value)}>
              <option value="">Ninguna</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Registrar evidencia'}
        </button>
      </form>
    </Card>
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
  const [file, setFile] = useState<StoredFile | null>(null);
  const [saving, setSaving] = useState(false);

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
      onSaved();
    } catch (e2) {
      onError(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Registrar certificado externo">
      <form onSubmit={submit}>
        <div className="row">
          <div className="field">
            <label>Nombre del certificado</label>
            <input
              value={form.certificateName}
              onChange={(e) => setForm({ ...form, certificateName: e.target.value })}
              placeholder="Fundamentos de pruebas automatizadas"
              required
            />
          </div>
          <div className="field">
            <label>Entidad emisora</label>
            <input
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              placeholder="Plataforma externa de formación"
              required
            />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Fecha de emisión</label>
            <input
              type="date"
              value={form.issueDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Área académica</label>
            <select
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
          <label>Descripción</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Curso de 40 horas con evaluación final"
            maxLength={300}
          />
        </div>
        <div className="row">
          <div className="field">
            <label>Enlace de verificación (opcional)</label>
            <input
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
            <label>Código de credencial (opcional)</label>
            <input
              value={form.credentialId}
              onChange={(e) => setForm({ ...form, credentialId: e.target.value })}
              placeholder="AF-2026-00417"
              maxLength={80}
            />
          </div>
        </div>
        <FilePicker
          file={file}
          onPicked={setFile}
          onError={onError}
          label="Archivo del certificado (opcional)"
        />
        <button className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Registrar certificado'}
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
    : verdict.backingTier === 'supported' ? 'bordo' : 'gray';

  return (
    <div className="respaldo">
      <Badge tone={tono}>{BACKING_TIER_LABEL[verdict.backingTier]}</Badge>
      <span className="muted">{BACKING_TIER_HELP[verdict.backingTier]}</span>

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
