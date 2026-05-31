import { useEffect, useState } from 'react';
import { apiError } from '../api/client';
import { activityService, catalogService } from '../services';
import type { AcademicArea, Activity, Registration } from '../services/types';
import { Card, Loading, EmptyState, Badge } from './ui';
import { ACTIVITY_CATEGORIES, ACTIVITY_MODALITIES, ACTIVITY_STATUSES, REGISTRATION_BADGE } from '../constants';

export default function ActivityManager({ activityType }: { activityType: 'academica' | 'extracurricular' }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [form, setForm] = useState({ title: '', description: '', category: ACTIVITY_CATEGORIES[0].value, modality: 'presencial', areaId: '', capacity: '', status: 'open' });

  const load = () => activityService.list({ type: activityType }).then(setActivities);

  useEffect(() => {
    Promise.all([activityService.list({ type: activityType }), catalogService.areas()])
      .then(([a, ar]) => { setActivities(a); setAreas(ar); })
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
      await load();
    } catch (err) { setError(apiError(err)); }
  };

  const openParticipants = async (id: string) => {
    setSelected(id);
    setParticipants([]);
    try { setParticipants(await activityService.participants(id)); } catch (e) { setError(apiError(e)); }
  };

  const confirm = async (activityId: string, studentProfileId: string, status: string) => {
    try {
      await activityService.confirm(activityId, studentProfileId, status);
      setParticipants(await activityService.participants(activityId));
    } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <Loading />;

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
            <div className="field"><label>Cupo</label><input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
            <div className="field"><label>Estado</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {ACTIVITY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
            <thead><tr><th>Título</th><th>Categoría</th><th>Estado</th><th>Cupo</th><th></th></tr></thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td className="muted">{a.category}</td>
                  <td><Badge tone="bordo">{a.status}</Badge></td>
                  <td>{a.capacity ?? '—'}</td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => openParticipants(a.id)}>Participantes</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selected && (
        <Card title="Participantes y confirmación">
          {participants.length === 0 ? <EmptyState message="Sin inscritos todavía." /> : (
            <table>
              <thead><tr><th>Estudiante</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id}>
                    <td>{p.studentProfile?.user ? `${p.studentProfile.user.firstName} ${p.studentProfile.user.lastName}` : p.studentProfileId}</td>
                    <td><Badge tone={(REGISTRATION_BADGE[p.status] ?? 'badge-gray').replace('badge-', '')}>{p.status}</Badge></td>
                    <td className="flex">
                      <button className="btn btn-primary btn-sm" onClick={() => confirm(selected, p.studentProfileId, 'confirmed')}>Confirmar</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => confirm(selected, p.studentProfileId, 'absent')}>Ausente</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
