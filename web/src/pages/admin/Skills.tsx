import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiSave, FiSearch, FiTool, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { AcademicArea, Skill } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonTable,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const emptyForm = { name: '', academicAreaId: '' };

export default function AdminSkillsPage() {
  const { data, loading, error, reload } = useAsync(() => catalogService.skills(), []);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    catalogService.areas().then(setAreas).catch(() => {});
  }, []);

  const notify = (t: string) => toast.success(t);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const rows = data ?? [];
    if (!q) return rows;
    return rows.filter((s) =>
      [s.name, s.academicArea?.name ?? ''].some((field) => normalize(field).includes(q)),
    );
  }, [data, query]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (skill: Skill) => {
    setEditing(skill);
    setForm({ name: skill.name, academicAreaId: skill.academicAreaId ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirm = useConfirm();

  const toggleActive = async (skill: Skill) => {
    if (skill.isActive) {
      const ok = await confirm({
        title: `Dar de baja “${skill.name}”`,
        message:
          'Dejará de ofrecerse al declarar habilidades. Las que ya la tienen declarada la conservan.',
        confirmLabel: 'Dar de baja',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await adminService.updateSkill(skill.id, { isActive: !skill.isActive });
      notify(skill.isActive ? 'Habilidad dada de baja.' : 'Habilidad reactivada.');
      reload();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <div>
      <PageHeader
        title="Catálogo de habilidades"
        description="Habilidades que los estudiantes pueden declarar con un nivel de 1 a 5. El área asociada es la que recibe puntaje en el motor de afinidad."
      />

      <Card
        title={editing ? `Editar “${editing.name}”` : 'Agregar habilidad'}
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
          <Button type="submit" loading={saving} icon={editing ? <FiSave size={15} /> : <FiPlus size={15} />}>
            {editing ? 'Guardar cambios' : 'Crear habilidad'}
          </Button>
        </form>
      </Card>

      <Card
        title="Habilidades registradas"
        actions={
          (data ?? []).length > 0 ? (
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Buscar habilidad o área…"
              />
              <ResultCount
                shown={visible.length}
                total={(data ?? []).length}
                noun="habilidades"
              />
            </div>
          ) : undefined
        }
      >
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          skeleton={<SkeletonTable rows={5} columns={4} />}
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              icon={<FiTool size={22} />}
              message="Todavía no hay habilidades en el catálogo."
            />
          }
          emptyMessage="Todavía no hay habilidades en el catálogo."
        >
          {() =>
            visible.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ninguna habilidad coincide con “${query}”.`}
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
                  <th>Habilidad</th>
                  <th>Área</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
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
                        <Button variant="secondary" size="sm" onClick={() => startEdit(s)}>
                          Editar
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(s)}>
                          {s.isActive ? 'Dar de baja' : 'Reactivar'}
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
