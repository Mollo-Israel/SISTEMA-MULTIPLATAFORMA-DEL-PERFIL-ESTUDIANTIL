import { useEffect, useState } from 'react';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { AcademicArea } from '../../services/types';
import { AsyncView, Card } from '../../components/ui';

export default function AdminSkillsPage() {
  const { data, loading, error, reload } = useAsync(() => catalogService.skills(), []);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [form, setForm] = useState({ name: '', academicAreaId: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { catalogService.areas().then(setAreas).catch(() => {}); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      await adminService.createSkill({ name: form.name, academicAreaId: form.academicAreaId || undefined });
      setForm({ name: '', academicAreaId: '' });
      setMsg('Habilidad creada.');
      reload();
    } catch (e2) { setErr(apiError(e2)); }
  };

  return (
    <div>
      <h1>Catálogo de habilidades</h1>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card title="Agregar habilidad">
        <form onSubmit={create}>
          <div className="row">
            <div className="field"><label>Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Área académica</label>
              <select value={form.academicAreaId} onChange={(e) => setForm({ ...form, academicAreaId: e.target.value })}>
                <option value="">Sin área</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary">Crear habilidad</button>
        </form>
      </Card>

      <Card title="Habilidades registradas">
        <AsyncView loading={loading} error={error} data={data} isEmpty={(d) => d.length === 0}>
          {(skills) => (
            <table>
              <thead><tr><th>Habilidad</th><th>Área</th></tr></thead>
              <tbody>
                {skills.map((s) => <tr key={s.id}><td>{s.name}</td><td className="muted">{s.academicArea?.name ?? '—'}</td></tr>)}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
