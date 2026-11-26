import RegistrosVerificables from '../../components/RegistrosVerificables';
import CorreosComprobados from '../../components/CorreosComprobados';
import EstadosDeRespaldo from '../../components/EstadosDeRespaldo';
import { FieldError } from '../../components/form';
import { BotonArchivo } from '../../components/ArchivoProtegido';
import AreaSkillPicker from '../../components/AreaSkillPicker';
import { useEffect, useRef, useState } from 'react';
import { FiLink, FiFile, FiTrash2, FiExternalLink, FiAward, FiSearch } from 'react-icons/fi';
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
  AsyncView, Badge, Button, Card, EmptyState, Loading, Modal, PageHeader, ResultCount,
  SearchInput, SkeletonTable, Tabs,
} from '../../components/ui';
import { useSearchParams } from 'react-router-dom';
import { useConfirm, useToast } from '../../components/feedback';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
import {
  BACKING_TIER_HELP,
  BACKING_TIER_LABEL,
  CREDENTIAL_CHECK_LABEL,
  CREDENTIAL_CONTRADICTION_LABEL,
  FORENSIC_LABEL,
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
  CredentialPhase,
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

/** V4.1 A41-018: color del estado de validación (aparte del respaldo). */
const VALIDACION_TONO: Record<string, string> = {
  PENDING: 'gray',
  AUTO_VERIFIED: 'green',
  MANUALLY_VERIFIED: 'green',
  MANUAL_REVIEW_REQUIRED: 'amber',
  INCONCLUSIVE: 'gray',
  REJECTED: 'red',
  OBSERVED: 'amber',
  APPROVED: 'green',
};

type PestanaEvidencias = 'proyectos' | 'credenciales' | 'constancias' | 'verificables';

export default function StudentEvidencesPage() {
  // V4.1 A41-025 (§15): tres pestañas sobre los mismos datos; nada se duplica.
  const [params, setParams] = useSearchParams();
  const pedida = params.get('tab');
  const pestana: PestanaEvidencias = pedida === 'proyectos' || pedida === 'constancias' || pedida === 'verificables' ? pedida : 'credenciales';
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
    } catch (error_) {
      toast.error(apiError(error_));
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
    } catch (error_) {
      toast.error(apiError(error_));
    }
  };

  return (
    <div>
      <PageHeader
        title="Evidencias y credenciales"
        description="Tus credenciales externas y los certificados institucionales que recibiste. Afinia no las certifica: las valida por niveles y lo indica en cada una."
      />
      {/* V6 §10.2: qué significa cada estado de respaldo. */}
      <EstadosDeRespaldo />

      <Tabs
        items={[
          { key: 'proyectos', label: 'Evidencias de proyectos', count: evidences.data?.length },
          { key: 'credenciales', label: 'Credenciales externas', count: certificates.data?.length },
          { key: 'constancias', label: 'Certificados institucionales recibidos', count: (constancies.data as unknown[] | undefined)?.length },
          // V8: lo registrado, firmado digitalmente y verificable por terceros.
          { key: 'verificables', label: 'Registros verificables' },
        ]}
        value={pestana}
        onChange={(k) => setParams(k === 'credenciales' ? {} : { tab: k }, { replace: true })}
      />

      {pestana === 'proyectos' && (<>
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
                    {e.evidenceType === 'file' ? (
                      <BotonArchivo src={e.fileUrl ?? ''} nombre="evidencia">
                        <FiExternalLink /> Abrir
                      </BotonArchivo>
                    ) : (
                      <a className="btn btn-secondary btn-sm" href={e.externalUrl ?? '#'} target="_blank" rel="noreferrer">
                        <FiExternalLink /> Abrir
                      </a>
                    )}
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
      </>)}

      {pestana === 'credenciales' && (<>
      <p className="inline-note">
        Registra una credencial histórica (la obtuviste antes o fuera de Afinia) o acredita una oportunidad externa que ya terminó.
        Cada una muestra su estado de validación y qué se pudo verificar. Las constancias internas no se registran aquí: llegan solas
        a «Certificados institucionales recibidos».
      </p>
      <CertificateForm
        areas={areas}
        onError={(m) => toast.error(m)}
        onSaved={() => {
          notify('Certificado registrado.');
          certificates.reload();
        }}
      />

      <CorreosComprobados />

      <Card
        title="Mis credenciales y su validación"
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
                          <BotonArchivo src={c.fileUrl} nombre="certificado">
                            <FiFile /> Ver
                          </BotonArchivo>
                        ) : <>{c.certificateUrl ? (
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
                        )}</>}
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
      </>)}

      {pestana === 'verificables' && <RegistrosVerificables />}

      {pestana === 'constancias' && (
      <Card title="Certificados institucionales recibidos">
        <p className="muted" style={{ marginBottom: '0.7rem' }}>
          Las constancias internas las emite Afinia cuando el responsable confirma tu participación.
          Los certificados de la institución los emite quien figura como emisor; el responsable te los entrega aquí.
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
                      {c.kind === 'institution_certificate' && <span>Emitido por {c.issuerName ?? 'la institución'}</span>}
                      {c.certificateCode && <span>Código: {c.certificateCode}</span>}
                      {/* V7.1 §6.4 (DOC-04): se abre con la sesión del estudiante, no con un enlace suelto. */}
                      {c.fileUrl && (
                        <BotonArchivo src={c.fileUrl} nombre="certificado" className="link-button">Ver certificado</BotonArchivo>
                      )}
                      {c.activity && <span>Actividad: {c.activity.title}</span>}
                      <span>
                        {c.deliveredAt ? 'Entregado el ' : ''}{new Date(c.deliveredAt ?? c.createdAt).toLocaleDateString('es-BO', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <Badge tone="green">{c.kind === 'institution_certificate' ? 'Certificado' : 'Constancia'}</Badge>
                </div>
              ))}
            </div>
          )}
        </AsyncView>
      </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilePicker({
  file,
  onPicked,
  onError,
  label = 'Archivo',
}: Readonly<{
  file: StoredFile | null;
  onPicked: (f: StoredFile | null) => void;
  onError: (msg: string) => void;
  label?: string;
}>) {
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
    } catch (error_) {
      onError(apiError(error_, 'No se pudo subir el archivo.'));
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
}: Readonly<{
  areas: AcademicArea[];
  onSaved: () => void;
  onError: (m: string) => void;
}>) {
  const vacio = {
    certificateName: '',
    issuer: '',
    issueDate: '',
    description: '',
    certificateUrl: '',
    credentialId: '',
  };
  const [form, setForm] = useState(vacio);
  // V3 §15/§16: viene de una oportunidad terminada en la que participó, o
  // es histórica (anterior a Afinia o de algo que no pasó por aquí).
  const [oportunidades, setOportunidades] = useState<CredentialOpportunity[]>([]);
  const [activityId, setActivityId] = useState('');
  useEffect(() => {
    certificateService.eligibleOpportunities().then(setOportunidades).catch(() => setOportunidades([]));
  }, []);
  /**
   * V7.1 §5.2: en una vinculada, el nombre esperado, el emisor, las áreas y
   * las tecnologías vienen de la oportunidad. Se muestran, no se editan: el
   * servidor los deriva de la oportunidad y no del formulario.
   */
  const oportunidad = oportunidades.find((x) => x.activityId === activityId) ?? null;
  const vinculada = !!oportunidad;
  const [errores, setErrores] = useState<Record<string, string>>({});
  const elegirOportunidad = (id: string) => {
    setActivityId(id);
    setErrores({});
  };
  const [file, setFile] = useState<StoredFile | null>(null);
  const [saving, setSaving] = useState(false);
  // V2 §41: tecnologías que el certificado acredita, del catálogo.
  const [catalogo, setCatalogo] = useState<Skill[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  /** V3.2 §33, §50.1: áreas de la credencial y área de cada tecnología. */
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [contextos, setContextos] = useState<Record<string, string>>({});
  useEffect(() => {
    catalogService.skills().then((s) => setCatalogo(s.filter((x) => x.isActive !== false))).catch(() => {});
  }, []);

  /** Lo que se comprueba antes de enviar; el servidor vuelve a comprobarlo todo. */
  const erroresLocales = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (vinculada) {
      if (!file) e.file = 'Adjunta el certificado que recibiste: en una credencial de una oportunidad es obligatorio.';
      if (!oportunidad?.expectedIssuer && form.issuer.trim().length < 2) e.issuer = 'Indica quién emitió el certificado.';
      return e;
    }
    if (form.certificateName.trim().length < 3) e.certificateName = 'Escribe el nombre del certificado (al menos 3 letras).';
    if (form.issuer.trim().length < 2) e.issuer = 'Indica la entidad que lo emitió.';
    return e;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = erroresLocales();
    setErrores(locales);
    if (Object.keys(locales).length) return;
    setSaving(true);
    try {
      const verificacion = {
        certificateUrl: form.certificateUrl || undefined,
        credentialId: form.credentialId || undefined,
      };
      await certificateService.create(vinculada
        ? {
          // V7.1 §5.2: nombre, áreas y tecnologías los pone el servidor desde la oportunidad.
          activityId,
          ...(oportunidad?.expectedIssuer ? {} : { issuer: form.issuer }),
          issueDate: form.issueDate || undefined,
          description: form.description || undefined,
          ...verificacion,
          storedFileId: file?.id,
        }
        : {
          certificateName: form.certificateName,
          issuer: form.issuer,
          issueDate: form.issueDate || undefined,
          description: form.description || undefined,
          ...(areaIds.length ? { areaIds } : {}),
          ...verificacion,
          storedFileId: file?.id,
          skillIds: skillIds.length ? skillIds : undefined,
          skillContexts: skillIds
            .filter((id) => contextos[id] && areaIds.includes(contextos[id]))
            .map((id) => ({ skillId: id, areaId: contextos[id] })),
        });
      setForm(vacio);
      setErrores({});
      setFile(null);
      setSkillIds([]);
      setAreaIds([]);
      setContextos({});
      setActivityId('');
      certificateService.eligibleOpportunities().then(setOportunidades).catch(() => {});
      onSaved();
    } catch (error_) {
      onError(apiError(error_));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Registrar credencial histórica o acreditar una oportunidad externa finalizada">
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
        {oportunidad ? (
          <DatosDeLaOportunidad o={oportunidad} />
        ) : (
          <div className="row">
            <div className="field">
              <label htmlFor="cert-nombre">Nombre del certificado</label>
              <input
                id="cert-nombre"
                value={form.certificateName}
                onChange={(e) => setForm({ ...form, certificateName: e.target.value })}
                placeholder="Fundamentos de pruebas automatizadas"
                aria-invalid={!!errores.certificateName}
                required
              />
              {errores.certificateName && <span className="field-error">{errores.certificateName}</span>}
            </div>
            <div className="field">
              <label htmlFor="cert-emisor">Entidad emisora</label>
              <input
                id="cert-emisor"
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                placeholder="Plataforma externa de formación"
                aria-invalid={!!errores.issuer}
                required
              />
              {errores.issuer && <span className="field-error">{errores.issuer}</span>}
            </div>
          </div>
        )}
        {oportunidad && !oportunidad.expectedIssuer && (
          <div className="field">
            <label htmlFor="cert-emisor">Entidad emisora</label>
            <input
              id="cert-emisor"
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              placeholder="Quién firmó el certificado"
              aria-invalid={!!errores.issuer}
            />
            <span className="field-hint">La oportunidad no indica un emisor: escribe el que figura en tu certificado.</span>
            {errores.issuer && <span className="field-error">{errores.issuer}</span>}
          </div>
        )}
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
        {/*
          V7.1 §5.2: enlace y código son opcionales y van plegados. Se explica
          la diferencia: la página del curso no prueba quién lo cursó; el
          enlace individual y el código, sí pueden.
        */}
        <details className="verificacion-plegable" open={!!(form.certificateUrl || form.credentialId)}>
          <summary>Si tu certificado incluye enlace o código de verificación</summary>
          <p className="field-hint">
            La <strong>página del curso</strong> solo muestra que el curso existe. El <strong>enlace individual</strong> de tu
            certificado (el que abre tu registro, a veces desde un QR) y el <strong>código de credencial</strong> son los
            que identifican el tuyo. Si no los tienes, no pasa nada: igual se revisa.
          </p>
          <div className="row">
            <div className="field">
              <label htmlFor="evidences-enlace-de-verificacion-opcional">Enlace individual de verificación (opcional)</label>
              <input id="evidences-enlace-de-verificacion-opcional"
                type="url"
                value={form.certificateUrl}
                onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })}
                placeholder="https://emisor.example.com/cert/123"
              />
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
        </details>
        {!vinculada && (
          <>
            {/* V3.2 §33: áreas de la credencial y, en cada una, las tecnologías que acredita. */}
            <AreaSkillPicker
              areas={areas}
              skills={catalogo}
              value={{ areaIds, skillIds, contexts: contextos }}
              onChange={(v) => { setAreaIds(v.areaIds); setSkillIds(v.skillIds); setContextos(v.contexts ?? {}); }}
              areaLabel="Áreas de la credencial"
              skillLabel="Tecnologías que acredita (opcional)"
              maxAreas={6}
              maxSkills={15}
            />
            <p className="field-hint" style={{ marginTop: '-0.3rem' }}>
              Lo que declaras aquí lo revisa Dirección: no cuenta como respaldado por el solo hecho de registrarlo.
            </p>
          </>
        )}
        <FilePicker
          file={file}
          onPicked={(f) => { setFile(f); setErrores((x) => ({ ...x, file: '' })); }}
          onError={onError}
          label={vinculada ? 'Archivo del certificado (obligatorio)' : 'Archivo del certificado (o indica el enlace de verificación)'}
        />
        {errores.file && <p className="field-error" data-testid="falta-archivo">{errores.file}</p>}
        <p className="field-hint" data-testid="ruta-de-revision">{rutaDeRevision(oportunidad)}</p>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Enviar a revisión'}
        </button>
      </form>
    </Card>
  );
}

/**
 * V7.1 §5.2: lo que la credencial vinculada hereda de su oportunidad. Se lee,
 * no se edita: el servidor lo toma de la oportunidad.
 */
function DatosDeLaOportunidad({ o }: Readonly<{ o: CredentialOpportunity }>) {
  return (
    <div className="datos-oportunidad" data-testid="datos-oportunidad">
      <p className="muted small" style={{ marginTop: 0 }}>
        Estos datos vienen de la oportunidad y no se editan. Si tu certificado dice otra cosa, Dirección lo verá al revisarlo.
      </p>
      <dl>
        <dt>Nombre esperado</dt>
        <dd>{o.expectedName ?? o.expectedCourseName ?? o.title}</dd>
        <dt>Emisor esperado</dt>
        <dd>{o.expectedIssuer ?? 'No indicado por la oportunidad'}</dd>
        <dt>Áreas</dt>
        <dd>{o.areas?.length ? o.areas.map((a) => a.name).join(', ') : 'Sin áreas'}</dd>
        <dt>Tecnologías</dt>
        <dd>{o.skills?.length ? o.skills.map((s) => s.name).join(', ') : 'Sin tecnologías configuradas'}</dd>
      </dl>
    </div>
  );
}

/** V7.1 §5.3: qué pasa después de enviar, en palabras. */
function rutaDeRevision(o: CredentialOpportunity | null): string {
  if (!o) return 'Una credencial histórica no se compara automáticamente: va directo a la revisión de Dirección. Necesita el archivo o el enlace de verificación.';
  if (o.hasModel) return 'Al enviarla se compara con el certificado modelo de la oportunidad (texto, código y enlace) y luego la revisa Dirección. Si alguna comprobación no se puede hacer, igual se revisa.';
  return 'Esta oportunidad no tiene certificado modelo: va directo a la revisión de Dirección.';
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
function RespaldoDelCertificado({ certificateId }: Readonly<{ certificateId: string }>) {
  const [verdict, setVerdict] = useState<ValidationVerdict | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pidiendo, setPidiendo] = useState(false);
  // V5-22 (I01): modal propio en lugar de window.prompt / window.alert.
  const [notaRevision, setNotaRevision] = useState<string | null>(null);
  const [errorRevision, setErrorRevision] = useState<string | null>(null);

  const [comprobando, setComprobando] = useState(false);
  const [errorComprobar, setErrorComprobar] = useState<string | null>(null);
  const enCurso = verdict?.status === 'pending' || verdict?.status === 'processing';

  useEffect(() => {
    let vivo = true;
    validationService
      .forResource('external_certificate', certificateId)
      .then((v) => { if (vivo) setVerdict(v); })
      .catch(() => { /* sin veredicto todavía */ })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [certificateId]);

  // V7.1 §5.3: mientras se comprueba, el resultado llega solo; no hace falta recargar.
  useEffect(() => {
    if (!enCurso) return;
    let vueltas = 0;
    const t = window.setInterval(() => {
      vueltas += 1;
      validationService.forResource('external_certificate', certificateId).then(setVerdict).catch(() => {});
      if (vueltas >= 15) window.clearInterval(t);
    }, 4000);
    return () => window.clearInterval(t);
  }, [enCurso, certificateId]);

  if (cargando) return <span className="muted" style={{ fontSize: '0.76rem' }}>Cargando…</span>;
  if (!verdict) return <span className="muted" style={{ fontSize: '0.76rem' }}>Sin datos de revisión</span>;

  const comprobar = async () => {
    setComprobando(true);
    setErrorComprobar(null);
    try {
      await certificateService.check(certificateId);
      setVerdict(await validationService.forResource('external_certificate', certificateId));
    } catch (e) {
      setErrorComprobar(apiError(e));
    } finally {
      setComprobando(false);
    }
  };
  const fases = verdict.phases ?? [];
  const revisionDeDireccion = fases.find((f) => f.fase === 3);

  const tono = TONO_DE_RESPALDO[verdict.backingTier ?? ''] ?? 'gray';
  const chequeo = verdict.credentialCheck;
  const revision = verdict.manualReview;

  const pedirRevision = async () => {
    if (notaRevision === null) return;
    setPidiendo(true);
    try {
      await certificateService.requestManualReview(certificateId, notaRevision.trim());
      setNotaRevision(null);
      setVerdict(await validationService.forResource('external_certificate', certificateId));
    } catch (e) {
      setErrorRevision(apiError(e));
    } finally {
      setPidiendo(false);
    }
  };

  return (
    <div className="respaldo">
      {/* V7.1 §5.4: primero, en qué está la revisión de Dirección. */}
      {revisionDeDireccion && (
        <span data-testid="estado-revision">
          <Badge tone={TONO_DE_FASE[revisionDeDireccion.estado]}>{revisionDeDireccion.resumen}</Badge>
        </span>
      )}
      {fases.length > 0 && (
        <details className="fases-credencial" data-testid="fases-credencial">
          <summary>Detalle de la comprobación{enCurso ? ' (en curso)' : ''}</summary>
          <ol>
            {fases.map((f) => (
              <li key={f.fase} data-fase={f.fase} data-estado={f.estado}>
                <strong>{f.fase}. {f.titulo}</strong>{' '}
                <Badge tone={TONO_DE_FASE[f.estado]}>{ESTADO_DE_FASE[f.estado]}</Badge>
                {f.fecha && <span className="muted"> · {new Date(f.fecha).toLocaleDateString('es-BO')}</span>}
                <p>{f.resumen}</p>
                {f.detalles.length > 0 && <ul>{f.detalles.map((d) => <li key={d}>{d}</li>)}</ul>}
              </li>
            ))}
          </ol>
          {verdict.canRecheck && (
            <div className="fases-acciones">
              <Button variant="secondary" loading={comprobando} onClick={() => void comprobar()}>Comprobar información</Button>
              <span className="muted">Vuelve a leer tu archivo y a consultar la fuente. El resultado anterior se conserva y la revisión de Dirección no depende de esto.</span>
            </div>
          )}
          <FieldError message={errorComprobar} />
        </details>
      )}
      {verdict.validationStatus && !enCurso && (
        <span data-testid="estado-validacion">
          <Badge tone={VALIDACION_TONO[verdict.validationStatus.status]}>{verdict.validationStatus.label}</Badge>
        </span>
      )}
      <Badge tone={tono}>Respaldo: {BACKING_TIER_LABEL[verdict.backingTier]}</Badge>
      <span className="muted">{BACKING_TIER_HELP[verdict.backingTier]}</span>
      {verdict.providerSupport && (
        <span className="muted">{verdict.providerSupport.provider}: {verdict.providerSupport.note}</span>
      )}
      {chequeo && (
        <span className="muted" data-testid="consulta-proveedor">
          {/* V5 §15.2: Afinia informa el resultado de la consulta en una fecha; no certifica. */}
          Resultado de la consulta al proveedor{verdict.finishedAt ? ` el ${new Date(verdict.finishedAt).toLocaleDateString('es-BO')}` : ''}:{' '}
          {CREDENTIAL_CHECK_LABEL[chequeo.status].toLowerCase()}
          {chequeo.qr === 'qr_present' ? ' · QR leído (un QR que lleva a la página del curso no identifica al titular)' : ''}
        </span>
      )}
      {chequeo && chequeo.contradictions.length > 0 && (
        <span className="respaldo-aviso">
          {chequeo.contradictions.map((c) => CREDENTIAL_CONTRADICTION_LABEL[c] ?? c).join('; ')}.
        </span>
      )}
      {/* V9: lo que el archivo dice de sí mismo. Solo lo que cambia algo (críticas y advertencias). */}
      {chequeo?.forensics && chequeo.forensics.signals.some((x) => x.severity !== 'info') && (
        <span className="muted" data-testid="analisis-archivo">
          Análisis del archivo:{' '}
          {chequeo.forensics.signals
            .filter((x) => x.severity !== 'info')
            .map((x) => `${FORENSIC_LABEL[x.code] ?? x.code}${x.detail ? ` (${x.detail})` : ''}`)
            .join('; ')}
          . Sube el archivo original que te entregó el emisor o registra su enlace oficial.
        </span>
      )}
      {chequeo?.forensics?.signature?.signatureValid && chequeo.forensics.signature.trusted && chequeo.forensics.signature.issuerMatches && (
        <span className="muted" data-testid="firma-emisor">
          Firmado digitalmente por {chequeo.forensics.signature.signerOrganization ?? chequeo.forensics.signature.signerName}: la firma corresponde al contenido.
        </span>
      )}
      {chequeo?.openBadge?.provider === 'credly' && chequeo.openBadge.recipientMatch === false && (
        <span className="muted" data-testid="credly-correo">
          Credly no la emitió a tu correo institucional. Si la recibiste en un correo personal, compruébalo arriba en «Correos con los que recibes insignias».
        </span>
      )}
      {revision?.status === 'corroborated' && <span className="muted">Es una revisión administrativa de Dirección, no una certificación de Afinia.</span>}
      {revision?.canRequest && (
        <button type="button" className="link-button" disabled={pidiendo} onClick={() => { setNotaRevision(''); setErrorRevision(null); }}>
          {pidiendo ? 'Enviando…' : 'Pedir revisión a Dirección'}
        </button>
      )}
      {notaRevision !== null && (
        <Modal title="Pedir revisión a Dirección" subtitle="La revisa Dirección" onClose={() => setNotaRevision(null)} width={500}>
          <div className={`field ${errorRevision ? 'has-error' : ''}`}>
            <label htmlFor="revision-nota">Cuéntale a Dirección cómo puede comprobar esta credencial (opcional)</label>
            <textarea id="revision-nota" value={notaRevision} maxLength={500}
              onChange={(e) => { setNotaRevision(e.target.value); setErrorRevision(null); }} />
            <FieldError message={errorRevision} />
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setNotaRevision(null)}>Volver</Button>
            <Button loading={pidiendo} onClick={() => void pedirRevision()}>Pedir revisión</Button>
          </div>
        </Modal>
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

const TONO_DE_RESPALDO: Record<string, string> = { corroborated: 'green', supported: 'bordo', flagged: 'red' };

/**
 * V7.1 §5.4: cada fase con su estado real. Una fase terminada no es «verde»:
 * es un resultado que ayuda a Dirección, no una aprobación.
 */
const ESTADO_DE_FASE: Record<CredentialPhase['estado'], string> = {
  no_aplica: 'No aplica',
  omitida: 'Omitida',
  pendiente: 'Pendiente',
  procesando: 'Comprobando',
  completada: 'Con resultado',
  inconclusa: 'Inconclusa',
  error: 'Error técnico',
  sin_solicitud: 'Sin solicitud',
  decidida: 'Decidida',
  observada: 'Observada',
};
const TONO_DE_FASE: Record<CredentialPhase['estado'], string> = {
  no_aplica: 'gray', omitida: 'gray', pendiente: 'amber', procesando: 'gray', completada: 'bordo',
  inconclusa: 'gray', error: 'red', sin_solicitud: 'gray', decidida: 'bordo', observada: 'amber',
};
