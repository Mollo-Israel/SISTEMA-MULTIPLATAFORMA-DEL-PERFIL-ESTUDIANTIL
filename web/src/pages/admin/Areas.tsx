import { useState } from 'react';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card } from '../../components/ui';

export default function AdminAreasPage() {
  const { data, loading, error, reload } = useAsync(() => catalogService.areas(), []);
  const [form, setForm] = useState({ name: '', description: '', tags: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      await adminService.createArea({
        name: form.name,
        description: form.description || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
      setForm({ name: '', description: '', tags: '' });
      setMsg('Área creada.');
      reload();
    } catch (e2) { setErr(apiError(e2)); }
  };

  return (
    <div>
      <h1>Áreas académicas</h1>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card title="Crear área académica">
        <form onSubmit={create}>
          <div className="row">
            <div className="field"><label>Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Etiquetas (coma)</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="react, node, web" /></div>
          </div>
          <div className="field"><label>Descripción</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <button className="btn btn-primary">Crear área</button>
        </form>
      </Card>

      <Card title="Áreas registradas">
        <AsyncView loading={loading} error={error} data={data} isEmpty={(d) => d.length === 0}>
          {(areas) => (
            <table>
              <thead><tr><th>Nombre</th><th>Descripción</th><th>Etiquetas</th></tr></thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id}><td>{a.name}</td><td className="muted">{a.description}</td><td className="muted">{a.tags?.join(', ')}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
