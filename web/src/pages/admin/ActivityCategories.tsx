import { useState } from 'react';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge } from '../../components/ui';
import { ACTIVITY_TYPE_LABEL, lbl } from '../../constants';
import type { ActivityCategoryItem } from '../../services/types';

const emptyForm = { code: '', name: '', description: '', appliesTo: '' };

/**
 * Catálogo administrable de categorías de actividad (RF4).
 * Antes eran valores fijos del código; ahora el administrador las gestiona.
 */
export default function AdminActivityCategoriesPage() {
  const { data, loading, error, reload } = useAsync<ActivityCategoryItem[]>(
    () => catalogService.activityCategories(),
    [],
  );
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ActivityCategoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const notify = (t: string) => {
    setMsg(t);
    setErr(null);
    window.setTimeout(() => setMsg(null), 4000);
  };

  // El código identifica la categoría de forma estable; se sugiere a partir del
  // nombre para que el administrador no tenga que inventarlo.
  const suggestCode = (name: string) =>
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    const payload = {
      code: form.code || suggestCode(form.name),
      name: form.name,
      description: form.description || undefined,
      appliesTo: form.appliesTo || undefined,
    };
    try {
      if (editing) {
        await adminService.updateActivityCategory(editing.id, payload);
        notify('Categoría actualizada.');
      } else {
        await adminService.createActivityCategory(payload);
        notify('Categoría creada.');
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

  const startEdit = (c: ActivityCategoryItem) => {
    setEditing(c);
    setForm({
      code: c.code,
      name: c.name,
      description: c.description ?? '',
      appliesTo: c.appliesTo ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (c: ActivityCategoryItem) => {
    setErr(null);
    try {
      if (c.isActive) {
        const usage = await adminService.activityCategoryUsage(c.id);
        const aviso =
          usage.activities > 0
            ? `${usage.activities} actividad${usage.activities === 1 ? '' : 'es'} usa${usage.activities === 1 ? '' : 'n'} esta categoría. Al darla de baja dejará de ofrecerse para nuevas actividades, pero las existentes la conservan. ¿Continuar?`
            : `Dar de baja la categoría “${c.name}”. ¿Continuar?`;
        if (!window.confirm(aviso)) return;
      }
      await adminService.updateActivityCategory(c.id, { isActive: !c.isActive });
      notify(c.isActive ? 'Categoría dada de baja.' : 'Categoría reactivada.');
      reload();
    } catch (e2) {
      setErr(apiError(e2));
    }
  };

  return (
    <div>
      <h1>Categorías de actividad</h1>
      <p className="muted">
        Define las categorías que el director de carrera y la sociedad científica pueden elegir al
        publicar una actividad. Una categoría dada de baja deja de ofrecerse en los formularios,
        pero las actividades que ya la usan la conservan.
      </p>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <Card
        title={editing ? `Editar “${editing.name}”` : 'Nueva categoría'}
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    code: editing ? form.code : suggestCode(e.target.value),
                  })
                }
                placeholder="Mesa redonda"
                required
              />
            </div>
            <div className="field">
              <label>Código</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="mesa_redonda"
                required
              />
              <span className="muted" style={{ fontSize: '0.74rem' }}>
                Minúsculas, números y guion bajo. Se sugiere a partir del nombre.
              </span>
            </div>
            <div className="field">
              <label>Aplica a</label>
              <select
                value={form.appliesTo}
                onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
              >
                <option value="">Ambos tipos</option>
                <option value="academica">Solo académicas</option>
                <option value="extracurricular">Solo extracurriculares</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Qué tipo de actividad agrupa esta categoría."
            />
          </div>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </form>
      </Card>

      <Card title="Categorías registradas">
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          isEmpty={(d) => d.length === 0}
          emptyMessage="Todavía no hay categorías registradas."
        >
          {(rows) => (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Aplica a</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className={c.isActive ? '' : 'is-inactive'}>
                      <td>{c.name}</td>
                      <td>
                        <code>{c.code}</code>
                      </td>
                      <td className="muted">
                        {c.appliesTo ? lbl(ACTIVITY_TYPE_LABEL, c.appliesTo) : 'Ambos tipos'}
                      </td>
                      <td className="muted">{c.description ?? '—'}</td>
                      <td>
                        <Badge tone={c.isActive ? 'green' : 'gray'}>
                          {c.isActive ? 'Vigente' : 'De baja'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex" style={{ gap: '0.35rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>
                            Editar
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleActive(c)}
                          >
                            {c.isActive ? 'Dar de baja' : 'Reactivar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
