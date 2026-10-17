import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiAward, FiCheck, FiSend, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { gamificationService, projectService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../auth/AuthContext';
import type { GamificationProposal, ProjectBackingTier } from '../../services/types';
import { PROJECT_BACKING_LABEL } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, SkeletonTable, Tabs,
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
  return (
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
              <thead><tr><th>Estudiante</th><th>Semestre</th><th>Puntos</th></tr></thead>
              <tbody>
                {d.students.slice(0, 100).map((s) => (
                  <tr key={s.profileId}>
                    <td>{s.name}</td>
                    <td className="muted">{s.semester ? `${s.semester}º` : '—'}</td>
                    <td><strong>{s.points}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </Card>
  );
}

// ===========================================================================

const CAMPOS = ['projectId', 'studentProfileId', 'criterionId', 'reason'] as const;
type Campo = (typeof CAMPOS)[number];

function PropuestasDocente() {
  const proyectos = useAsync(() => projectService.institutional(), []);
  const criterios = useAsync(() => gamificationService.availableCriteria('proyecto_corroborado'), []);
  const mias = useAsync(() => gamificationService.proposals(), []);
  const [form, setForm] = useState<Record<Campo, string>>({ projectId: '', studentProfileId: '', criterionId: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS);
  const toast = useToast();

  const elegibles = useMemo(
    () => (proyectos.data?.projects ?? []).filter((p) => p.studentProfileId && RESPALDO_SUFICIENTE.includes(p.backingTier ?? '')),
    [proyectos.data],
  );
  const set = (c: Campo, v: string) => {
    setForm((f) => ({ ...f, [c]: v }));
    errores.clear(c);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales: Partial<Record<Campo, string>> = {};
    if (!form.projectId) locales.projectId = 'Elige el proyecto.';
    if (!form.criterionId) locales.criterionId = 'Elige el criterio.';
    if (form.reason.trim().length < 10) locales.reason = 'Explica por qué lo propones (al menos 10 caracteres).';
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    const proyecto = elegibles.find((p) => p.id === form.projectId);
    setSaving(true);
    try {
      await gamificationService.propose({
        projectId: form.projectId,
        studentProfileId: proyecto?.studentProfileId ?? '',
        criterionId: form.criterionId,
        reason: form.reason.trim(),
      });
      toast.success('Propuesta enviada.', 'Dirección la revisará; verás aquí su decisión.');
      setForm({ projectId: '', studentProfileId: '', criterionId: '', reason: '' });
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
      <Card title="Proponer puntos por un proyecto">
        <p className="muted" style={{ marginTop: 0 }}>
          Solo proyectos de tus semestres, visibles para docentes y con respaldo suficiente (respaldado, corroborado o
          revisado). Tú propones; Dirección aprueba o rechaza.
        </p>
        <form onSubmit={enviar} noValidate>
          <FormAlert message={errores.general} />
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
          <FormField label="Por qué lo propones" required error={errores.errors.reason} hint="Dirección lo verá al decidir.">
            <textarea value={form.reason} maxLength={500} onChange={(e) => set('reason', e.target.value)} placeholder="Qué logró el estudiante en este proyecto." />
          </FormField>
          <Button type="submit" loading={saving} icon={<FiSend size={15} />}>Enviar propuesta</Button>
        </form>
      </Card>
      <Card title="Tus propuestas">
        <ListaPropuestas estado={mias} />
      </Card>
    </>
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
              <tr><th>Proyecto</th><th>Estudiante</th><th>Criterio</th><th>Motivo</th><th>Estado</th>{acciones && <th></th>}</tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.project?.title ?? '—'}</strong>
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
                  <td><Badge tone={ESTADO[p.status].tone}>{ESTADO[p.status].label}</Badge></td>
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
