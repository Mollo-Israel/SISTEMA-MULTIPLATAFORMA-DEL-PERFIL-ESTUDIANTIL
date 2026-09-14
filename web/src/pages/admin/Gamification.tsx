import { useEffect, useMemo, useState } from 'react';
import { FiAward, FiPlus, FiSave, FiSearch, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { AcademicArea, GamificationCriterion } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonTable,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { GAMIFICATION_TRIGGERS, lbl } from '../../constants';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
    return rows.filter((c) =>
      [c.code, c.name, c.description ?? '', lbl(TRIGGER_LABEL, c.trigger),
        c.academicArea?.name ?? '']
        .some((field) => normalize(field).includes(q)),
    );
  }, [data, query]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(apiError(e2));
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

  const confirm = useConfirm();

  const toggleActive = async (c: GamificationCriterion) => {
    if (c.isActive) {
      const ok = await confirm({
        title: `Desactivar “${c.name}”`,
        message: 'El criterio dejará de aplicarse. Puede activarlo de nuevo cuando quiera.',
        confirmLabel: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await adminService.updateCriterion(c.id, { isActive: !c.isActive });
      notify(c.isActive ? 'Criterio desactivado.' : 'Criterio activado.');
      reload();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <div>
      <PageHeader
        title="Criterios de gamificación"
        description="Qué hechos del sistema otorgan puntos y cuántos. Los criterios se guardan y se administran aquí; el motor que los aplica a los estudiantes forma parte de una fase posterior del proyecto, así que todavía no se generan puntos ni insignias."
      />

      <Card
        title={editing ? `Editar “${editing.name}”` : 'Nuevo criterio'}
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
          <Button type="submit" loading={saving} icon={editing ? <FiSave size={15} /> : <FiPlus size={15} />}>
            {editing ? 'Guardar cambios' : 'Crear criterio'}
          </Button>
        </form>
      </Card>

      <Card
        title="Criterios definidos"
        actions={
          (data ?? []).length > 0 ? (
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Buscar criterio, código o hecho…"
              />
              <ResultCount
                shown={visible.length}
                total={(data ?? []).length}
                noun="criterios"
              />
            </div>
          ) : undefined
        }
      >
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          skeleton={<SkeletonTable rows={5} columns={7} />}
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              icon={<FiAward size={22} />}
              message="Todavía no hay criterios definidos."
            />
          }
          emptyMessage="Todavía no hay criterios definidos."
        >
          {() =>
            visible.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ningún criterio coincide con “${query}”.`}
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
                {visible.map((c) => (
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
                        <Button variant="secondary" size="sm" onClick={() => startEdit(c)}>
                          Editar
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(c)}>
                          {c.isActive ? 'Desactivar' : 'Activar'}
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
