import { useMemo, useState } from 'react';
import { FiLayers, FiPlus, FiSave, FiSearch, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonTable,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
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
  const [query, setQuery] = useState('');
  const toast = useToast();

  const notify = (t: string) => toast.success(t);

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

  const visible = useMemo(() => {
    const q = suggestCode(query.trim()).replace(/_/g, ' ');
    const rows = data ?? [];
    if (!q) return rows;
    return rows.filter((c) =>
      [c.name, c.code, c.description ?? '']
        .some((field) => suggestCode(field).replace(/_/g, ' ').includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(apiError(e2));
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

  const confirm = useConfirm();

  const toggleActive = async (c: ActivityCategoryItem) => {
    try {
      if (c.isActive) {
        const usage = await adminService.activityCategoryUsage(c.id);
        const aviso =
          usage.activities > 0
            ? `${usage.activities} actividad${usage.activities === 1 ? '' : 'es'} usa${usage.activities === 1 ? '' : 'n'} esta categoría. Dejará de ofrecerse para nuevas actividades, pero las existentes la conservan.`
            : 'Dejará de ofrecerse al publicar nuevas actividades. Puede reactivarla cuando quiera.';
        const ok = await confirm({
          title: `Dar de baja “${c.name}”`,
          message: aviso,
          confirmLabel: 'Dar de baja',
          tone: 'danger',
        });
        if (!ok) return;
      }
      await adminService.updateActivityCategory(c.id, { isActive: !c.isActive });
      notify(c.isActive ? 'Categoría dada de baja.' : 'Categoría reactivada.');
      reload();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <div>
      <PageHeader
        title="Categorías de actividad"
        description="Las categorías que el director de carrera y la sociedad científica eligen al publicar una actividad. Una dada de baja deja de ofrecerse en los formularios, pero las actividades que ya la usan la conservan."
      />

      <Card
        title={editing ? `Editar “${editing.name}”` : 'Nueva categoría'}
        actions={
          editing && (
            <Button
              variant="ghost"
              size="sm"
              icon={<FiX size={14} />}
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
              }}
            >
              Cancelar edición
            </Button>
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
          <Button type="submit" loading={saving} icon={editing ? <FiSave size={15} /> : <FiPlus size={15} />}>
            {editing ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
        </form>
      </Card>

      <Card
        title="Categorías registradas"
        actions={
          (data ?? []).length > 0 ? (
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Buscar categoría o código…"
              />
              <ResultCount
                shown={visible.length}
                total={(data ?? []).length}
                noun="categorías"
              />
            </div>
          ) : undefined
        }
      >
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          skeleton={<SkeletonTable rows={5} columns={6} />}
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              icon={<FiLayers size={22} />}
              message="Todavía no hay categorías registradas."
            />
          }
          emptyMessage="Todavía no hay categorías registradas."
        >
          {() =>
            visible.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ninguna categoría coincide con “${query}”.`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Limpiar búsqueda
                  </Button>
                }
              />
            ) : (
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
                  {visible.map((c) => (
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
                          <Button variant="secondary" size="sm" onClick={() => startEdit(c)}>
                            Editar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleActive(c)}
                          >
                            {c.isActive ? 'Dar de baja' : 'Reactivar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          }
        </AsyncView>
      </Card>
    </div>
  );
}
