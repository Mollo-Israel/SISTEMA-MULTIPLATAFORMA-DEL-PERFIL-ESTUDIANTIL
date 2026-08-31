import { useState } from 'react';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge } from '../../components/ui';
import type { AcademicArea } from '../../services/types';

const emptyForm = { name: '', description: '', tags: '' };

export default function AdminAreasPage() {
  const { data, loading, error, reload } = useAsync(() => catalogService.areas(), []);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<AcademicArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const notify = (t: string) => {
    setMsg(t);
    setErr(null);
    window.setTimeout(() => setMsg(null), 4000);
  };

  const parseTags = (raw: string) =>
    raw
      ? raw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || undefined,
      tags: parseTags(form.tags),
    };
    try {
      if (editing) {
        await adminService.updateArea(editing.id, payload);
        notify('Área actualizada.');
      } else {
        await adminService.createArea(payload);
        notify('Área creada.');
      }
      setForm(emptyForm);
      setEditing(null);
      reload();
    } catch (e2) {
      setErr(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (area: AcademicArea) => {
    setEditing(area);
    setForm({
      name: area.name,
      description: area.description ?? '',
      tags: (area.tags ?? []).join(', '),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (area: AcademicArea) => {
    setErr(null);
    try {
      await adminService.updateArea(area.id, { isActive: !area.isActive });
      notify(area.isActive ? 'Área dada de baja.' : 'Área reactivada.');
      reload();
    } catch (e2) {
      setErr(apiError(e2));
    }
  };

  return (
    <div>
      <h1>Áreas académicas</h1>
      <p className="muted">
        Catálogo que alimenta intereses, habilidades, actividades y el motor de afinidad. Un área
        dada de baja deja de ofrecerse en los formularios pero conserva su historial.
      </p>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card
        title={editing ? `Editar “${editing.name}”` : 'Crear área académica'}
        actions={
          editing && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
              }}
            >
              Cancelar edición
            </button>
          )
        }
      >
        <form onSubmit={submit}>
          <div className="row">
            <div className="field">
              <label>Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Computación en la Nube"
                required
              />
            </div>
            <div className="field">
              <label>Etiquetas (separadas por coma)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="aws, docker, kubernetes"
              />
            </div>
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Qué abarca esta área dentro de la carrera."
            />
          </div>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear área'}
          </button>
        </form>
      </Card>

      <Card title="Áreas registradas">
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          isEmpty={(d) => d.length === 0}
          emptyMessage="Todavía no hay áreas académicas."
        >
          {(areas) => (
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Etiquetas</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id} className={a.isActive ? '' : 'is-inactive'}>
                    <td>{a.name}</td>
                    <td className="muted">{a.description ?? '—'}</td>
                    <td className="muted">{a.tags?.join(', ') || '—'}</td>
                    <td>
                      <Badge tone={a.isActive ? 'green' : 'gray'}>
                        {a.isActive ? 'Vigente' : 'De baja'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex" style={{ gap: '0.35rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(a)}>
                          Editar
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(a)}>
                          {a.isActive ? 'Dar de baja' : 'Reactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
