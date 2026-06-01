import { useEffect, useState } from 'react';
import { apiError } from '../api/client';
import { activityService, catalogService } from '../services';
import type { AcademicArea, Activity, Registration } from '../services/types';
import { Card, Loading, EmptyState, Badge } from './ui';
import {
  ACTIVITY_CATEGORIES, ACTIVITY_MODALITIES, ACTIVITY_STATUS_LABEL, ACTIVITY_STATUSES,
  REGISTRATION_BADGE, REGISTRATION_STATUS_LABEL, lbl,
} from '../constants';

const catLabel = (v: string) => ACTIVITY_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export default function ActivityManager({ activityType }: { activityType: 'academica' | 'extracurricular' }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [parts, setParts] = useState<Record<string, Registration[]>>({});
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: ACTIVITY_CATEGORIES[0].value, modality: 'presencial', areaId: '', capacity: '', status: 'open' });

  const loadAll = async () => {
    const list = await activityService.list({ type: activityType });
    setActivities(list);
    const entries = await Promise.all(
      list.map(async (a) => [a.id, await activityService.participants(a.id).catch(() => [])] as const),
    );
    setParts(Object.fromEntries(entries));
  };

  useEffect(() => {
    Promise.all([loadAll(), catalogService.areas().then(setAreas)])
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityType]);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMsg(null);
    try {
      await activityService.create({
        title: form.title,
        description: form.description || undefined,
        type: activityType,
        category: form.category,
        modality: form.modality,
        areaId: form.areaId || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        status: form.status,
      } as never);
      setForm({ ...form, title: '', description: '', capacity: '' });
      setMsg('Actividad publicada.');
      await loadAll();
    } catch (err) { setError(apiError(err)); }
  };

  const decide = async (activityId: string, studentProfileId: string, status: 'confirmed' | 'absent') => {
    setError(null); setMsg(null);
    try {
      await activityService.confirm(activityId, studentProfileId, status);
      const updated = await activityService.participants(activityId);
      setParts((p) => ({ ...p, [activityId]: updated }));
      setMsg(status === 'confirmed' ? 'Solicitud aprobada.' : 'Solicitud rechazada.');
    } catch (e) { setError(apiError(e)); }
  };

  const countOf = (id: string, st: string) => (parts[id] ?? []).filter((r) => r.status === st).length;

  if (loading) return <Loading />;

  const selectedActivity = activities.find((a) => a.id === selected);
  const selParts = selected ? parts[selected] ?? [] : [];
  const pending = selParts.filter((r) => r.status === 'registered');
  const confirmedList = selParts.filter((r) => r.status === 'confirmed');
  const others = selParts.filter((r) => r.status === 'interested' || r.status === 'absent');
  const confirmedCount = selected ? countOf(selected, 'confirmed') : 0;
  const full = !!(selectedActivity?.capacity && confirmedCount >= selectedActivity.capacity);
  const name = (r: Registration) => (r.studentProfile?.user ? `${r.studentProfile.user.firstName} ${r.studentProfile.user.lastName}` : r.studentProfileId);

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <Card title={`Publicar actividad ${activityType === 'academica' ? 'académica' : 'extracurricular'}`}>
        <form onSubmit={publish}>
          <div className="row">
            <div className="field"><label>Título</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="field"><label>Categoría</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {ACTIVITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Descripción</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="row">
            <div className="field"><label>Modalidad</label>
              <select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}>
                {ACTIVITY_MODALITIES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Área</label>
              <select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
                <option value="">Sin área</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Cupo</label><input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Sin límite" /></div>
            <div className="field"><label>Estado</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {ACTIVITY_STATUSES.map((s) => <option key={s} value={s}>{lbl(ACTIVITY_STATUS_LABEL, s)}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary">Publicar</button>
        </form>
      </Card>

      <div className="section-title"><h2>Actividades publicadas</h2></div>
      {activities.length === 0 ? <EmptyState message="Sin actividades." /> : (
        <Card>
          <table>
            <thead><tr><th>Título</th><th>Categoría</th><th>Estado</th><th>Cupo (aprobados)</th><th>Solicitudes</th><th></th></tr></thead>
            <tbody>
              {activities.map((a) => {
                const pend = countOf(a.id, 'registered');
                const conf = countOf(a.id, 'confirmed');
                return (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td className="muted">{catLabel(a.category)}</td>
                    <td><Badge tone="bordo">{lbl(ACTIVITY_STATUS_LABEL, a.status)}</Badge></td>
                    <td>{conf} / {a.capacity ?? '∞'}</td>
                    <td>{pend > 0 ? <Badge tone="amber">{pend} pendiente(s)</Badge> : <span className="muted">—</span>}</td>
                    <td><button className={`btn btn-sm ${selected === a.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelected(a.id)}>Gestionar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {selectedActivity && (
        <Card title={`Solicitudes · ${selectedActivity.title}`}>
          <p className="muted">
            Aprobados: <strong>{confirmedCount}</strong> / {selectedActivity.capacity ?? '∞'}
            {full && ' · cupo lleno'}
          </p>

          <h3 style={{ marginTop: '1rem' }}>Pendientes de aprobación ({pending.length})</h3>
          {pending.length === 0 ? <p className="muted">No hay solicitudes pendientes.</p> : (
            <table>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>{name(r)}</td>
                    <td style={{ width: 90 }}><Badge tone="amber">Pendiente</Badge></td>
                    <td className="flex" style={{ width: 230 }}>
                      <button className="btn btn-primary btn-sm" disabled={full} title={full ? 'Cupo lleno' : ''} onClick={() => decide(selectedActivity.id, r.studentProfileId, 'confirmed')}>Aprobar</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => decide(selectedActivity.id, r.studentProfileId, 'absent')}>Rechazar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginTop: '1.2rem' }}>Confirmados ({confirmedList.length})</h3>
          {confirmedList.length === 0 ? <p className="muted">Aún no hay confirmados.</p> : (
            <table>
              <tbody>
                {confirmedList.map((r) => (
                  <tr key={r.id}>
                    <td>{name(r)}</td>
                    <td style={{ width: 110 }}><Badge tone="green">Confirmado</Badge></td>
                    <td style={{ width: 120 }}><button className="btn btn-secondary btn-sm" onClick={() => decide(selectedActivity.id, r.studentProfileId, 'absent')}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {others.length > 0 && (
            <>
              <h3 style={{ marginTop: '1.2rem' }}>Otros</h3>
              <table>
                <tbody>
                  {others.map((r) => (
                    <tr key={r.id}>
                      <td>{name(r)}</td>
                      <td><Badge tone={(REGISTRATION_BADGE[r.status] ?? 'badge-gray').replace('badge-', '')}>{lbl(REGISTRATION_STATUS_LABEL, r.status)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
