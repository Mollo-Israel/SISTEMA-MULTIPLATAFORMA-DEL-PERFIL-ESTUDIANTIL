import { useEffect, useState } from 'react';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { AcademicArea, Skill } from '../../services/types';
import { AsyncView, Card, Badge } from '../../components/ui';

const emptyForm = { name: '', academicAreaId: '' };

export default function AdminSkillsPage() {
  const { data, loading, error, reload } = useAsync(() => catalogService.skills(), []);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    catalogService.areas().then(setAreas).catch(() => {});
  }, []);

  const notify = (t: string) => {
    setMsg(t);
    setErr(null);
    window.setTimeout(() => setMsg(null), 4000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    const payload = { name: form.name, academicAreaId: form.academicAreaId || undefined };
    try {
      if (editing) {
        await adminService.updateSkill(editing.id, payload);
        notify('Habilidad actualizada.');
      } else {
        await adminService.createSkill(payload);
        notify('Habilidad creada.');
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

  const startEdit = (skill: Skill) => {
    setEditing(skill);
    setForm({ name: skill.name, academicAreaId: skill.academicAreaId ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (skill: Skill) => {
    setErr(null);
    try {
      await adminService.updateSkill(skill.id, { isActive: !skill.isActive });
      notify(skill.isActive ? 'Habilidad dada de baja.' : 'Habilidad reactivada.');
      reload();
    } catch (e2) {
      setErr(apiError(e2));
    }
  };

  return (
    <div>
      <h1>Catálogo de habilidades</h1>
      <p className="muted">
        Habilidades que los estudiantes pueden declarar con un nivel de 1 a 5. El área asociada es
        la que recibe puntaje en el motor de afinidad.
      </p>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card
        title={editing ? `Editar “${editing.name}”` : 'Agregar habilidad'}
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
                placeholder="GraphQL"
                required
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
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear habilidad'}
          </button>
        </form>
      </Card>

      <Card title="Habilidades registradas">
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          isEmpty={(d) => d.length === 0}
          emptyMessage="Todavía no hay habilidades en el catálogo."
        >
          {(skills) => (
            <table>
              <thead>
                <tr>
                  <th>Habilidad</th>
                  <th>Área</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => (
                  <tr key={s.id} className={s.isActive ? '' : 'is-inactive'}>
                    <td>{s.name}</td>
                    <td className="muted">{s.academicArea?.name ?? '—'}</td>
                    <td>
                      <Badge tone={s.isActive ? 'green' : 'gray'}>
                        {s.isActive ? 'Vigente' : 'De baja'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex" style={{ gap: '0.35rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(s)}>
                          Editar
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(s)}>
                          {s.isActive ? 'Dar de baja' : 'Reactivar'}
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
