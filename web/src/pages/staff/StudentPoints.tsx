import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiAward, FiCheck, FiSend, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { approvalPolicyService, gamificationService, learningResourceService, projectService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../auth/AuthContext';
import type { GamificationProposal, ProjectBackingTier } from '../../services/types';
import { PROJECT_BACKING_LABEL } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, SkeletonTable, Tabs,
} from '../../components/ui';
import { FormAlert, FormField, useFormErrors } from '../../components/form';
import { useToast } from '../../components/feedback';

type Pestana = 'puntos' | 'propuestas';
const PERIODO_LABEL = { week: 'Esta semana', month: 'Este mes', year: 'Este año' } as const;
const ESTADO: Record<GamificationProposal['status'], { label: string; tone: string }> = {
  pending: { label: 'Pendiente de Dirección', tone: 'amber' },
  approved: { label: 'Aprobada', tone: 'green' },
  rejected: { label: 'Rechazada', tone: 'gray' },
};
/** Respaldo mínimo para proponer (lo mismo que exige la API). */
const RESPALDO_SUFICIENTE = ['supported', 'corroborated', 'reviewed'];

/**
 * V4.1 A41-016 (§9, A.10) · Puntos de estudiantes.
 *
 * Reemplaza «Retos y recompensas»: ya no hay puntos libres ni canjes. Los
 * puntos salen de criterios que configura Dirección o Administración; el
 * docente propone un criterio sobre un proyecto de un estudiante de su alcance
 * y Dirección decide. Nada de esto cambia la afinidad.
 */
export default function StudentPointsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') === 'propuestas' ? 'propuestas' : 'puntos') as Pestana;
  const { user } = useAuth();
  const esDocente = user?.role === 'TEACHER';
  return (
    <div>
      <PageHeader
        title="Puntos de estudiantes"
        description={esDocente
          ? 'Mira los puntos de los estudiantes que acompañas y propone premiar un proyecto con un criterio configurado. Dirección decide; los puntos no cambian la afinidad.'
          : 'Puntos por criterios configurados y propuestas de los docentes para revisar. Los puntos motivan; no cambian la afinidad.'}
      />
      <Tabs
        items={[
          { key: 'puntos', label: 'Puntos' },
          { key: 'propuestas', label: esDocente ? 'Mis propuestas' : 'Propuestas por revisar' },
        ]}
        value={tab}
        onChange={(k) => setParams(k === 'puntos' ? {} : { tab: k }, { replace: true })}
      />
      {tab === 'puntos' ? <PuntosTab /> : esDocente ? <PropuestasDocente /> : <BandejaDireccion />}
    </div>
  );
}

// ===========================================================================

function PuntosTab() {
  const [periodo, setPeriodo] = useState<'week' | 'month' | 'year'>('month');
  const [buscar, setBuscar] = useState('');
  const [q, setQ] = useState('');
  // Se consulta al dejar de escribir: cada consulta queda en la auditoría.
  useEffect(() => {
    const t = setTimeout(() => setQ(buscar.trim()), 400);
    return () => clearTimeout(t);
  }, [buscar]);
  const puntos = useAsync(() => gamificationService.scopePoints(periodo, q || undefined), [periodo, q]);
  // V5 §10.3: el detalle de cada estudiante.
  const [viendo, setViendo] = useState<string | null>(null);
  return (
    <>
    <Card
      title="Puntos por estudiante"
      actions={
        <select aria-label="Periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)}>
          {Object.entries(PERIODO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>Solo lo ve el personal de la carrera, y el docente solo ve sus semestres. No hay tabla pública.</p>
      <input
        aria-label="Buscar estudiante"
        placeholder="Buscar por nombre"
        value={buscar}
        maxLength={80}
        onChange={(e) => setBuscar(e.target.value)}
        style={{ marginBottom: '0.8rem', maxWidth: 320 }}
      />
      <AsyncView
        loading={puntos.loading}
        error={puntos.error}
        data={puntos.data}
        skeleton={<SkeletonTable rows={4} columns={3} />}
        isEmpty={(d) => d.students.length === 0}
        emptyMessage="No hay estudiantes en tu alcance todavía."
      >
        {(d) => (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Estudiante</th><th>Semestre</th><th>Puntos</th><th><span className="sr-only">Detalle</span></th></tr></thead>
              <tbody>
                {d.students.slice(0, 100).map((s) => (
                  <tr key={s.profileId}>
                    <td>{s.name}</td>
                    <td className="muted">{s.semester ? `${s.semester}º` : '—'}</td>
                    <td><strong>{s.points}</strong></td>
                    <td>
                      <Button size="sm" variant="secondary" onClick={() => setViendo(s.profileId)} aria-label={`Ver historial de ${s.name}`}>
                        Ver historial
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </Card>
    {viendo && <HistorialEstudiante profileId={viendo} onClose={() => setViendo(null)} />}
    </>
  );
}

// ===========================================================================

const CAMPOS = ['projectId', 'resourceId', 'studentProfileId', 'criterionId', 'reason'] as const;
type Campo = (typeof CAMPOS)[number];
type Reconoce = 'project' | 'resource';
const VACIO: Record<Campo, string> = { projectId: '', resourceId: '', studentProfileId: '', criterionId: '', reason: '' };

function PropuestasDocente() {
  const proyectos = useAsync(() => projectService.institutional(), []);
  const criterios = useAsync(() => gamificationService.availableCriteria('proyecto_corroborado'), []);
  const mias = useAsync(() => gamificationService.proposals(), []);
  // V5 §9.2: con autonomía de Dirección, otorga sin revisión (y Dirección lo ve).
  const politica = useAsync(() => approvalPolicyService.mine(), []);
  const directo = politica.data?.GAMIFICATION === 'DIRECT_ALLOWED';
  // V5 §8.3 y §10: un recurso con criterio de «completado» y un estudiante de su alcance.
  const recursos = useAsync(() => learningResourceService.list(), []);
  const criteriosRecurso = useAsync(() => gamificationService.availableCriteria('recurso_completado_atestiguado'), []);
  const estudiantes = useAsync(() => gamificationService.scopePoints('year'), []);
  const [reconoce, setReconoce] = useState<Reconoce>('project');
  const [form, setForm] = useState<Record<Campo, string>>(VACIO);
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS);
  const toast = useToast();

  const elegibles = useMemo(
    () => (proyectos.data?.projects ?? []).filter((p) => p.studentProfileId && RESPALDO_SUFICIENTE.includes(p.backingTier ?? '')),
    [proyectos.data],
  );
  const conCriterio = useMemo(
    () => (recursos.data ?? []).filter((r) => r.criterionId && r.status === 'active'
      && (r.reviewStatus === undefined || r.reviewStatus === 'not_required' || r.reviewStatus === 'approved')),
    [recursos.data],
  );
  const recurso = conCriterio.find((r) => r.id === form.resourceId);
  const criterioDelRecurso = (criteriosRecurso.data ?? []).find((c) => c.id === recurso?.criterionId);
  const set = (c: Campo, v: string) => {
    setForm((f) => ({ ...f, [c]: v }));
    errores.clear(c);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales: Partial<Record<Campo, string>> = {};
    if (reconoce === 'project') {
      if (!form.projectId) locales.projectId = 'Elige el proyecto.';
      if (!form.criterionId) locales.criterionId = 'Elige el criterio.';
    } else {
      if (!form.resourceId) locales.resourceId = 'Elige el recurso.';
      if (!form.studentProfileId) locales.studentProfileId = 'Elige el estudiante.';
    }
    if (form.reason.trim().length < 10) {
      locales.reason = reconoce === 'resource'
        ? 'Explica cómo sabes que lo completó (al menos 10 caracteres).'
        : 'Explica por qué lo propones (al menos 10 caracteres).';
    }
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      if (reconoce === 'project') {
        const proyecto = elegibles.find((p) => p.id === form.projectId);
        await gamificationService.propose({
          projectId: form.projectId,
          studentProfileId: proyecto?.studentProfileId ?? '',
          criterionId: form.criterionId,
          reason: form.reason.trim(),
        });
      } else {
        await gamificationService.propose({
          resourceId: form.resourceId,
          studentProfileId: form.studentProfileId,
          criterionId: recurso?.criterionId ?? '',
          reason: form.reason.trim(),
        });
      }
      if (directo) toast.success('Puntos otorgados.', 'Quedan en el historial del estudiante y Dirección los ve.');
      else toast.success('Propuesta enviada.', 'Dirección la revisará; verás aquí su decisión.');
      setForm(VACIO);
      errores.reset();
      mias.reload();
    } catch (e2) {
      errores.fromApi(e2);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card title={directo ? 'Otorgar puntos' : 'Proponer puntos'}>
        <p className="muted" style={{ marginTop: 0 }}>
          {directo
            ? 'Dirección te concedió otorgar puntos sin revisión: se aplican al guardar, quedan registrados con tu nombre y el motivo, y Dirección los ve.'
            : 'Tú propones; Dirección aprueba o rechaza.'}
          {' '}Los puntos motivan: no cambian la afinidad ni el respaldo de un proyecto.
        </p>
        <form onSubmit={enviar} noValidate>
          <FormAlert message={errores.general} />
          <div className="field">
            <span className="field-label" id="reconoce">Qué reconoces</span>
            <div role="radiogroup" aria-labelledby="reconoce" className="flex" style={{ gap: '1rem', flexWrap: 'wrap' }}>
              <label className="flex" style={{ gap: '0.35rem' }}>
                <input type="radio" name="reconoce" checked={reconoce === 'project'} onChange={() => { setReconoce('project'); setForm(VACIO); errores.reset(); }} />
                <span>Un proyecto</span>
              </label>
              <label className="flex" style={{ gap: '0.35rem' }}>
                <input type="radio" name="reconoce" checked={reconoce === 'resource'} onChange={() => { setReconoce('resource'); setForm(VACIO); errores.reset(); }} />
                <span>Un recurso completado</span>
              </label>
            </div>
          </div>
          {reconoce === 'project' ? (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Solo proyectos de tus semestres, visibles para docentes y con respaldo suficiente (respaldado, corroborado o revisado).
              </p>
              <div className="row">
                <FormField label="Proyecto" required error={errores.errors.projectId ?? errores.errors.studentProfileId}>
                  <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
                    <option value="">{elegibles.length ? 'Elige un proyecto' : 'No hay proyectos con respaldo suficiente'}</option>
                    {elegibles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} — {p.student ?? 'Estudiante'} ({PROJECT_BACKING_LABEL[p.backingTier as ProjectBackingTier] ?? p.backingTier})
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Criterio" required error={errores.errors.criterionId}>
                  <select value={form.criterionId} onChange={(e) => set('criterionId', e.target.value)}>
                    <option value="">{(criterios.data ?? []).length ? 'Elige un criterio' : 'No hay criterios de proyecto vigentes'}</option>
                    {(criterios.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name} · {c.points} puntos</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Das fe de que el estudiante completó el recurso (por ejemplo, entregó el ejercicio o lo presentó en clase).
                Abrirlo, descargarlo o guardarlo en favoritos no cuenta. Solo aparecen recursos con criterio de «completado».
              </p>
              <div className="row">
                <FormField label="Recurso" required error={errores.errors.resourceId ?? errores.errors.criterionId}
                  hint={criterioDelRecurso ? `${criterioDelRecurso.name} · ${criterioDelRecurso.points} puntos` : undefined}>
                  <select value={form.resourceId} onChange={(e) => set('resourceId', e.target.value)}>
                    <option value="">{conCriterio.length ? 'Elige un recurso' : 'No hay recursos con criterio de completado'}</option>
                    {conCriterio.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </FormField>
                <FormField label="Estudiante" required error={errores.errors.studentProfileId}>
                  <select value={form.studentProfileId} onChange={(e) => set('studentProfileId', e.target.value)}>
                    <option value="">{(estudiantes.data?.students ?? []).length ? 'Elige un estudiante' : 'No hay estudiantes en tu alcance'}</option>
                    {(estudiantes.data?.students ?? []).map((s) => (
                      <option key={s.profileId} value={s.profileId}>{s.name}{s.semester ? ` · ${s.semester}º` : ''}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </>
          )}
          <FormField
            label={reconoce === 'resource' ? 'Cómo sabes que lo completó' : directo ? 'Por qué lo otorgas' : 'Por qué lo propones'}
            required
            error={errores.errors.reason}
            hint={directo ? 'Queda en el historial; Dirección lo verá.' : 'Dirección lo verá al decidir.'}
          >
            <textarea
              value={form.reason}
              maxLength={500}
              onChange={(e) => set('reason', e.target.value)}
              placeholder={reconoce === 'resource' ? 'Qué entregó o mostró, y cuándo.' : 'Qué logró el estudiante en este proyecto.'}
            />
          </FormField>
          <Button type="submit" loading={saving} icon={<FiSend size={15} />}>{directo ? 'Otorgar puntos' : 'Enviar propuesta'}</Button>
        </form>
      </Card>
      <Card title="Tus propuestas">
        <ListaPropuestas estado={mias} />
      </Card>
    </>
  );
}

const ESTADO_MOVIMIENTO: Record<'APPLIED' | 'REVERSED' | 'PENDING', { label: string; tone: string }> = {
  APPLIED: { label: 'Aplicado', tone: 'green' },
  REVERSED: { label: 'Revertido', tone: 'gray' },
  PENDING: { label: 'Pendiente', tone: 'amber' },
};
const ORIGEN_LABEL = { activity: 'Actividad', project: 'Proyecto', resource: 'Recurso', other: 'Otro' } as const;

/** V5 §10.3: de dónde salió cada punto, quién lo otorgó y quién lo aprobó. */
function HistorialEstudiante({ profileId, onClose }: Readonly<{ profileId: string; onClose: () => void }>) {
  const h = useAsync(() => gamificationService.studentHistory(profileId), [profileId], { cache: false });
  return (
    <Modal title="Historial de puntos" subtitle={h.data ? `${h.data.student.name} · ${h.data.totalPoints} puntos` : undefined} onClose={onClose} width={860}>
      <AsyncView
        loading={h.loading}
        error={h.error}
        data={h.data}
        skeleton={<SkeletonTable rows={4} columns={6} />}
        isEmpty={(d) => d.items.length === 0}
        emptyMessage="Todavía no tiene puntos."
      >
        {(d) => (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Fecha</th><th>Puntos</th><th>Criterio</th><th>Origen</th><th>Otorgó · aprobó</th><th>Estado</th></tr></thead>
              <tbody>
                {d.items.map((i) => (
                  <tr key={`${i.status}:${i.id}`} data-testid="movimiento-puntos">
                    <td className="small">{new Date(i.at).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td><strong>{i.points > 0 ? `+${i.points}` : i.points}</strong></td>
                    <td className="small">{i.criterion ?? i.family ?? '—'}</td>
                    <td className="small">
                      {ORIGEN_LABEL[i.origin.type]}{i.origin.title ? `: ${i.origin.title}` : ''}
                      <div className="muted">{i.reason}</div>
                    </td>
                    <td className="small">
                      {i.awardedBy ?? 'El sistema'}
                      {i.approvedBy && <div className="muted">Aprobó {i.approvedBy}</div>}
                    </td>
                    <td><Badge tone={ESTADO_MOVIMIENTO[i.status].tone}>{ESTADO_MOVIMIENTO[i.status].label}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </Modal>
  );
}

function ListaPropuestas({
  estado,
  acciones,
}: {
  estado: ReturnType<typeof useAsync<GamificationProposal[]>>;
  acciones?: (p: GamificationProposal) => React.ReactNode;
}) {
  return (
    <AsyncView
      loading={estado.loading}
      error={estado.error}
      data={estado.data}
      skeleton={<SkeletonTable rows={3} columns={5} />}
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState icon={<FiAward size={22} />} message="No hay propuestas." />}
    >
      {(lista) => (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Origen</th><th>Estudiante</th><th>Criterio</th><th>Motivo</th><th>Estado</th>{acciones && <th></th>}</tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.project?.title ?? (p.resource ? `Recurso: ${p.resource.title}` : '—')}</strong>
                    {p.project && (
                      <div className="muted small">
                        Respaldo: {PROJECT_BACKING_LABEL[p.project.backingTier as ProjectBackingTier] ?? p.project.backingTier}
                      </div>
                    )}
                  </td>
                  <td>{p.student?.name ?? '—'}{p.student?.semester ? <span className="muted"> · {p.student.semester}º</span> : null}</td>
                  <td>{p.criterion ? <>{p.criterion.name} <Badge tone="bordo">+{p.criterion.points}</Badge></> : '—'}</td>
                  <td className="small">
                    {p.reason}
                    {p.proposedBy && <div className="muted">Propone {p.proposedBy}</div>}
                    {p.reviewComment && <div className="muted">Dirección: {p.reviewComment}</div>}
                  </td>
                  <td>
                    <Badge tone={ESTADO[p.status].tone}>{ESTADO[p.status].label}</Badge>
                    {p.direct && <div className="muted small">Directo, con autonomía docente</div>}
                  </td>
                  {acciones && <td>{acciones(p)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AsyncView>
  );
}

export function BandejaDireccion() {
  const [estado, setEstado] = useState<GamificationProposal['status']>('pending');
  const lista = useAsync(() => gamificationService.proposals(estado), [estado]);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const decidir = async (p: GamificationProposal, decision: 'approve' | 'reject') => {
    const comentario = comentarios[p.id]?.trim();
    if (decision === 'reject' && !comentario) {
      toast.error('Explica por qué se rechaza.');
      return;
    }
    setBusy(p.id);
    try {
      await gamificationService.reviewProposal(p.id, decision, comentario || undefined);
      toast.success(decision === 'approve' ? 'Propuesta aprobada: los puntos entraron al historial.' : 'Propuesta rechazada.');
      lista.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="Propuestas de los docentes"
      actions={
        <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
        </select>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Revisa el proyecto, su respaldo y el motivo. Al aprobar, los puntos del criterio entran una sola vez al historial del estudiante.
      </p>
      <ListaPropuestas
        estado={lista}
        acciones={estado === 'pending' ? (p) => (
          <div className="stack" style={{ gap: '0.35rem', minWidth: 180 }}>
            <input
              aria-label="Comentario"
              placeholder="Comentario (obligatorio al rechazar)"
              value={comentarios[p.id] ?? ''}
              onChange={(e) => setComentarios((c) => ({ ...c, [p.id]: e.target.value }))}
            />
            <div className="flex" style={{ gap: '0.35rem' }}>
              <Button size="sm" icon={<FiCheck size={13} />} loading={busy === p.id} onClick={() => decidir(p, 'approve')}>Aprobar</Button>
              <Button size="sm" variant="secondary" icon={<FiX size={13} />} disabled={busy === p.id} onClick={() => decidir(p, 'reject')}>Rechazar</Button>
            </div>
          </div>
        ) : undefined}
      />
    </Card>
  );
}
