import { useMemo, useState } from 'react';
import { FiGrid, FiPlus, FiSave, FiSearch, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonTable,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import type { AcademicArea } from '../../services/types';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const emptyForm = { name: '', description: '', tags: '' };

export default function AdminAreasPage() {
  const { data, loading, error, reload } = useAsync(() => catalogService.areas(), []);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<AcademicArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const toast = useToast();

  const notify = (t: string) => toast.success(t);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const rows = data ?? [];
    if (!q) return rows;
    return rows.filter((a) =>
      [a.name, a.description ?? '', (a.tags ?? []).join(' ')]
        .some((field) => normalize(field).includes(q)),
    );
  }, [data, query]);

  const parseTags = (raw: string) =>
    raw
      ? raw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(apiError(e2));
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

  const confirm = useConfirm();

  const toggleActive = async (area: AcademicArea) => {
    if (area.isActive) {
      const ok = await confirm({
        title: `Dar de baja “${area.name}”`,
        message:
          'Dejará de ofrecerse al declarar intereses, proyectos y actividades. ' +
          'Lo ya registrado con esta área se conserva.',
        confirmLabel: 'Dar de baja',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await adminService.updateArea(area.id, { isActive: !area.isActive });
      notify(area.isActive ? 'Área dada de baja.' : 'Área reactivada.');
      reload();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <div>
      <PageHeader
        title="Áreas académicas"
        description="Catálogo que alimenta intereses, habilidades, actividades y el motor de afinidad. Un área dada de baja deja de ofrecerse en los formularios pero conserva su historial."
      />

      <Card
        title={editing ? `Editar “${editing.name}”` : 'Crear área académica'}
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
          <Button type="submit" loading={saving} icon={editing ? <FiSave size={15} /> : <FiPlus size={15} />}>
            {editing ? 'Guardar cambios' : 'Crear área'}
          </Button>
        </form>
      </Card>

      <Card
        title="Áreas registradas"
        actions={
          (data ?? []).length > 0 ? (
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Buscar área o etiqueta…"
              />
              <ResultCount shown={visible.length} total={(data ?? []).length} noun="áreas" />
            </div>
          ) : undefined
        }
      >
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          skeleton={<SkeletonTable rows={5} columns={5} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<FiGrid size={22} />} message="Todavía no hay áreas académicas." />}
          emptyMessage="Todavía no hay áreas académicas."
        >
          {() =>
            visible.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ningún área coincide con “${query}”.`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Limpiar búsqueda
                  </Button>
                }
              />
            ) : (
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
                {visible.map((a) => (
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
                        <Button variant="secondary" size="sm" onClick={() => startEdit(a)}>
                          Editar
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(a)}>
                          {a.isActive ? 'Dar de baja' : 'Reactivar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )
          }
        </AsyncView>
      </Card>
    </div>
  );
}
