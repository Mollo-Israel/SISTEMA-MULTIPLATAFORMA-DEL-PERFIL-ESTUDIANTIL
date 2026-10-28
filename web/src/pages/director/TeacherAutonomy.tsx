import { useMemo, useState } from 'react';
import { FiUnlock, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { approvalPolicyService } from '../../services';
import type { ApprovalModule, ApprovalPolicyView } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, SkeletonTable,
} from '../../components/ui';
import { FieldError, FormAlert, FormField, useFormErrors } from '../../components/form';
import { useToast } from '../../components/feedback';
import { useAuth } from '../../auth/AuthContext';

const MODULO: Record<ApprovalModule, string> = {
  RESOURCE: 'Publicar recursos',
  GAMIFICATION: 'Otorgar puntos',
  ACTIVITY: 'Publicar actividades',
};

const fecha = (v: string | null) =>
  v ? new Date(v).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const CAMPOS = ['teacherUserId', 'module', 'justification'] as const;

/**
 * Autonomía docente (V5 §9.2).
 *
 * Sin excepción, todo docente está en «revisión obligatoria»: lo que propone
 * pasa por la bandeja de Aprobaciones. Dirección puede conceder a un docente
 * publicar recursos u otorgar puntos sin revisión; lo que haga con ella queda
 * en el historial de abajo, no en la bandeja. Revocar afecta lo que venga y no
 * deshace lo ya publicado u otorgado. Las actividades siguen siempre con
 * revisión mientras no haya una decisión institucional.
 */
export default function TeacherAutonomyPage() {
  const { user } = useAuth();
  const esDireccion = user?.role === 'CAREER_DIRECTOR';
  const [verRevocadas, setVerRevocadas] = useState(false);
  const politicas = useAsync(() => approvalPolicyService.list(verRevocadas), [verRevocadas]);
  const docentes = useAsync(() => approvalPolicyService.teachers(), []);
  const [filtroDocente, setFiltroDocente] = useState('');
  const historial = useAsync(() => approvalPolicyService.directActions(filtroDocente || undefined), [filtroDocente]);
  const [form, setForm] = useState<{ teacherUserId: string; module: ApprovalModule; justification: string }>({
    teacherUserId: '', module: 'RESOURCE', justification: '',
  });
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS);
  const toast = useToast();

  const [revocando, setRevocando] = useState<ApprovalPolicyView | null>(null);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);

  const yaTiene = useMemo(() => new Set((politicas.data ?? []).filter((p) => !p.revokedAt).map((p) => `${p.teacher.id}:${p.module}`)), [politicas.data]);

  const conceder = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales: Partial<Record<(typeof CAMPOS)[number], string>> = {};
    if (!form.teacherUserId) locales.teacherUserId = 'Elige el docente.';
    if (form.justification.trim().length < 10) locales.justification = 'Explica por qué se concede (al menos 10 caracteres).';
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      await approvalPolicyService.grant({ ...form, justification: form.justification.trim() });
      toast.success('Autonomía concedida.', 'Desde ahora lo que haga en ese módulo queda en el historial, sin pasar por la bandeja.');
      setForm({ teacherUserId: '', module: form.module, justification: '' });
      errores.reset();
      politicas.reload();
    } catch (error_) {
      errores.fromApi(error_);
    } finally {
      setSaving(false);
    }
  };

  const revocar = async () => {
    if (!revocando) return;
    if (motivo.trim().length < 5) {
      setErrorMotivo('Explica por qué se revoca.');
      return;
    }
    setSaving(true);
    try {
      await approvalPolicyService.revoke(revocando.id, motivo.trim());
      toast.success('Autonomía revocada.', 'Lo que proponga desde ahora vuelve a la bandeja. Lo ya hecho se conserva.');
      setRevocando(null);
      setMotivo('');
      politicas.reload();
    } catch (error_) {
      setErrorMotivo(apiError(error_));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Autonomía docente"
        description="Por defecto, lo que propone un docente pasa por revisión. Aquí Dirección concede a docentes concretos publicar recursos u otorgar puntos sin revisión, y ve lo que hicieron con ese permiso."
      />

      {esDireccion && (
        <Card title="Conceder autonomía">
          <form onSubmit={conceder} noValidate>
            <FormAlert message={errores.general} />
            <div className="row">
              <FormField label="Docente" required error={errores.errors.teacherUserId}>
                <select value={form.teacherUserId} onChange={(e) => { setForm({ ...form, teacherUserId: e.target.value }); errores.clear('teacherUserId'); }}>
                  <option value="">{(docentes.data ?? []).length ? 'Elige un docente' : 'No hay docentes activos'}</option>
                  {(docentes.data ?? []).map((d) => (
                    <option key={d.id} value={d.id} disabled={yaTiene.has(`${d.id}:${form.module}`)}>
                      {d.name}{d.semesters.length ? ` · ${d.semesters.map((s) => `${s}º`).join(', ')}` : ' · sin semestres'}
                      {yaTiene.has(`${d.id}:${form.module}`) ? ' (ya la tiene)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Módulo" required error={errores.errors.module}>
                <select value={form.module} onChange={(e) => { setForm({ ...form, module: e.target.value as ApprovalModule }); errores.clear('module'); }}>
                  <option value="RESOURCE">{MODULO.RESOURCE}</option>
                  <option value="GAMIFICATION">{MODULO.GAMIFICATION}</option>
                  <option value="ACTIVITY" disabled>{MODULO.ACTIVITY} (siempre con revisión)</option>
                </select>
              </FormField>
            </div>
            <FormField
              label="Por qué se concede"
              required
              error={errores.errors.justification}
              hint="Queda en el historial con tu nombre y la fecha. La sociedad científica no hereda estas excepciones."
            >
              <textarea
                value={form.justification}
                maxLength={500}
                onChange={(e) => { setForm({ ...form, justification: e.target.value }); errores.clear('justification'); }}
                placeholder="Por ejemplo: coordina la materia en los paralelos A, B y C y acordó los criterios con Dirección."
              />
            </FormField>
            <Button type="submit" loading={saving} icon={<FiUnlock size={15} />}>Conceder</Button>
          </form>
        </Card>
      )}

      <Card
        title="Excepciones"
        actions={
          <label className="flex" style={{ gap: '0.4rem', fontSize: '0.82rem' }}>
            <input type="checkbox" checked={verRevocadas} onChange={(e) => setVerRevocadas(e.target.checked)} />
            <span>Ver también las revocadas</span>
          </label>
        }
      >
        <AsyncView
          loading={politicas.loading}
          error={politicas.error}
          data={politicas.data}
          skeleton={<SkeletonTable rows={3} columns={5} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<FiUnlock size={22} />} message="Ningún docente tiene autonomía: todo pasa por revisión." />}
        >
          {(lista) => (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Docente</th><th>Módulo</th><th>Concedida</th><th>Motivo</th><th>Estado</th>{esDireccion && <th><span className="sr-only">Acciones</span></th>}</tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id} data-testid="politica">
                      <td>{p.teacher.name ?? '—'}</td>
                      <td>{MODULO[p.module]}</td>
                      <td className="small">{fecha(p.grantedAt)}{p.grantedBy && <div className="muted">por {p.grantedBy}</div>}</td>
                      <td className="small">
                        {p.justification}
                        {p.revokeReason && <div className="muted">Revocada: {p.revokeReason}</div>}
                      </td>
                      <td>
                        {p.revokedAt
                          ? <><Badge tone="gray">Revocada</Badge><div className="muted small">{fecha(p.revokedAt)}{p.revokedBy ? ` · ${p.revokedBy}` : ''}</div></>
                          : <Badge tone="green">Vigente</Badge>}
                      </td>
                      {esDireccion && (
                        <td>
                          {!p.revokedAt && (
                            <Button size="sm" variant="danger" icon={<FiX size={13} />} onClick={() => { setRevocando(p); setMotivo(''); setErrorMotivo(null); }}>
                              Revocar
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>

      <Card
        title="Historial de acciones directas"
        actions={
          <select aria-label="Docente del historial" value={filtroDocente} onChange={(e) => setFiltroDocente(e.target.value)}>
            <option value="">Todos los docentes</option>
            {(docentes.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Lo que un docente publicó u otorgó con su autonomía. No hace falta aprobarlo: está aquí para que Dirección lo vea.
        </p>
        <AsyncView
          loading={historial.loading}
          error={historial.error}
          data={historial.data}
          skeleton={<SkeletonTable rows={3} columns={4} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<FiUnlock size={22} />} message="Todavía no hay acciones directas." />}
        >
          {(lista) => (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Fecha</th><th>Docente</th><th>Qué hizo</th><th>Detalle</th></tr></thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={`${a.module}:${a.id}`} data-testid="accion-directa">
                      <td className="small">{fecha(a.at)}</td>
                      <td>{a.teacher}</td>
                      <td>{a.module === 'RESOURCE' ? 'Publicó un recurso' : 'Otorgó puntos'}</td>
                      <td className="small">
                        {a.module === 'RESOURCE'
                          ? <strong>{a.title}</strong>
                          : <><strong>{a.student}</strong> · {a.criterion} <Badge tone="bordo">+{a.points}</Badge><div className="muted">{a.reason}</div></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>

      {revocando && (
        <Modal title="Revocar autonomía" subtitle={`${revocando.teacher.name ?? 'Docente'} · ${MODULO[revocando.module]}`} onClose={() => setRevocando(null)} width={500}>
          <p className="muted">
            Lo que proponga desde ahora vuelve a la bandeja de Aprobaciones. Lo que ya publicó u otorgó no se deshace.
          </p>
          <div className={`field ${errorMotivo ? 'has-error' : ''}`}>
            <label htmlFor="revocar-motivo">Motivo</label>
            <textarea id="revocar-motivo" value={motivo} maxLength={500} onChange={(e) => { setMotivo(e.target.value); setErrorMotivo(null); }} />
            <FieldError message={errorMotivo} />
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setRevocando(null)}>Volver</Button>
            <Button variant="danger" loading={saving} onClick={() => void revocar()}>Revocar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
