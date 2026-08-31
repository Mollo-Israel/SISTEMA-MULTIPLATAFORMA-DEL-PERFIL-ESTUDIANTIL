import { useEffect, useState } from 'react';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { AcademicArea, GamificationCriterion } from '../../services/types';
import { AsyncView, Card, Badge } from '../../components/ui';
import { GAMIFICATION_TRIGGERS, lbl } from '../../constants';

const TRIGGER_LABEL: Record<string, string> = Object.fromEntries(
  GAMIFICATION_TRIGGERS.map((t) => [t.value, t.label]),
);

const emptyForm = {
  code: '',
  name: '',
  description: '',
  trigger: GAMIFICATION_TRIGGERS[0].value,
  points: '10',
  academicAreaId: '',
};

export default function AdminGamificationPage() {
  const { data, loading, error, reload } = useAsync(() => adminService.listCriteria(), []);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<GamificationCriterion | null>(null);
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
    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || undefined,
      trigger: form.trigger,
      points: Number(form.points),
      academicAreaId: form.academicAreaId || undefined,
    };
    try {
      if (editing) {
        await adminService.updateCriterion(editing.id, payload);
        notify('Criterio actualizado.');
      } else {
        await adminService.createCriterion(payload);
        notify('Criterio creado.');
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

  const startEdit = (c: GamificationCriterion) => {
    setEditing(c);
    setForm({
      code: c.code,
      name: c.name,
      description: c.description ?? '',
      trigger: c.trigger,
      points: String(c.points),
      academicAreaId: c.academicAreaId ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (c: GamificationCriterion) => {
    setErr(null);
    try {
      await adminService.updateCriterion(c.id, { isActive: !c.isActive });
      notify(c.isActive ? 'Criterio desactivado.' : 'Criterio activado.');
      reload();
    } catch (e2) {
      setErr(apiError(e2));
    }
  };

  return (
    <div>
      <h1>Criterios de gamificación</h1>
      <p className="muted">
        Define qué hechos del sistema otorgan puntos y cuántos. Los criterios se guardan y se
        administran aquí; el motor que los aplica a los estudiantes forma parte de una fase
        posterior del proyecto, así que todavía no se generan puntos ni insignias.
      </p>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card
        title={editing ? `Editar “${editing.name}”` : 'Nuevo criterio'}
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
              <label>Código</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="participacion_taller"
                required
              />
            </div>
            <div className="field">
              <label>Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Participación confirmada en taller"
                required
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Hecho que lo otorga</label>
              <select
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}
              >
                {GAMIFICATION_TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Puntos</label>
              <input
                type="number"
                min={0}
                max={1000}
                value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Área académica (opcional)</label>
              <select
                value={form.academicAreaId}
                onChange={(e) => setForm({ ...form, academicAreaId: e.target.value })}
              >
                <option value="">Todas las áreas</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Cuándo se otorga y con qué propósito."
            />
          </div>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear criterio'}
          </button>
        </form>
      </Card>

      <Card title="Criterios definidos">
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          isEmpty={(d) => d.length === 0}
          emptyMessage="Todavía no hay criterios definidos."
        >
          {(criteria) => (
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Hecho</th>
                  <th>Puntos</th>
                  <th>Área</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => (
                  <tr key={c.id} className={c.isActive ? '' : 'is-inactive'}>
                    <td>
                      <code>{c.code}</code>
                    </td>
                    <td>{c.name}</td>
                    <td className="muted">{lbl(TRIGGER_LABEL, c.trigger)}</td>
                    <td>{c.points}</td>
                    <td className="muted">{c.academicArea?.name ?? 'Todas'}</td>
                    <td>
                      <Badge tone={c.isActive ? 'green' : 'gray'}>
                        {c.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex" style={{ gap: '0.35rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>
                          Editar
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(c)}>
                          {c.isActive ? 'Desactivar' : 'Activar'}
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
