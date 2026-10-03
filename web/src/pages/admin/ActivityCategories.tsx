import { useMemo, useState } from 'react';
import { FiEdit2, FiLayers, FiPlus, FiSearch } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, ResultCount, SearchInput,
  SkeletonTable,
} from '../../components/ui';
import { FormAlert, FormField, useFormErrors } from '../../components/form';
import { useConfirm, useToast } from '../../components/feedback';
import { ACTIVITY_TYPE_LABEL, lbl } from '../../constants';
import type { ActivityCategoryItem } from '../../services/types';
import { catalogName, optionalText, suggestCode, validate, type Validator } from '../../lib/validators';

const CAMPOS = ['name', 'code', 'appliesTo', 'description'] as const;
type Campo = (typeof CAMPOS)[number];
/** «Aplica a» siempre tiene valor: por omisión, ambos tipos. Nunca «ninguno». */
const vacia: Record<Campo, string> = { name: '', code: '', appliesTo: 'ambos', description: '' };

/** Mismo formato que valida el servidor para el código de una categoría. */
const codigoCategoria: Validator = (v) => {
  const t = (v ?? '').trim();
  if (!t) return 'Escribe un código.';
  if (!/^[a-z0-9_]{3,60}$/.test(t)) return 'Minúsculas, números y guion bajo (3 a 60 caracteres).';
  return null;
};

function reglas(f: Record<Campo, string>) {
  return validate(f, {
    name: catalogName('de la categoría'),
    code: codigoCategoria,
    appliesTo: (v) => (['ambos', 'academica', 'extracurricular'].includes(v) ? null : 'Elige a qué tipo de actividad aplica.'),
    description: optionalText(255),
  });
}

function aPayload(f: Record<Campo, string>) {
  return {
    name: f.name.trim(),
    code: f.code.trim(),
    // null = sirve para ambos tipos. Se envía explícito para que, al editar,
    // una categoría restringida pueda volver a servir para los dos.
    appliesTo: f.appliesTo === 'ambos' ? null : f.appliesTo,
    description: f.description.trim() || null,
  };
}

function CategoriaForm({
  value,
  onChange,
  errors,
  onFieldTouched,
  sugerirCodigo,
}: {
  value: Record<Campo, string>;
  onChange: (v: Record<Campo, string>) => void;
  errors: Partial<Record<Campo, string>>;
  onFieldTouched: (c: Campo) => void;
  sugerirCodigo: boolean;
}) {
  const set = (campo: Campo, v: string) => {
    const next = { ...value, [campo]: v };
    if (campo === 'name' && sugerirCodigo) next.code = suggestCode(v);
    onChange(next);
    onFieldTouched(campo);
  };
  return (
    <>
      <div className="row">
        <FormField label="Nombre" required error={errors.name}>
          <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="Mesa redonda" />
        </FormField>
        <FormField label="Código" required error={errors.code} hint="Se sugiere a partir del nombre.">
          <input
            className="mono"
            value={value.code}
            onChange={(e) => set('code', e.target.value.toLowerCase())}
            placeholder="mesa_redonda"
          />
        </FormField>
        <FormField
          label="Aplica a"
          required
          error={errors.appliesTo}
          hint="Quién puede usarla al publicar: dirección (académicas) o sociedad (extracurriculares)."
        >
          <select value={value.appliesTo} onChange={(e) => set('appliesTo', e.target.value)}>
            <option value="ambos">Ambos tipos</option>
            <option value="academica">Solo académicas</option>
            <option value="extracurricular">Solo extracurriculares</option>
          </select>
        </FormField>
      </div>
      <FormField label="Descripción" error={errors.description} hint="Opcional.">
        <textarea
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Qué tipo de actividad agrupa esta categoría."
        />
      </FormField>
    </>
  );
}

/**
 * Catálogo administrable de categorías de actividad (RF4).
 *
 * Son de otra naturaleza que áreas y habilidades: las elige quien organiza la
 * actividad, y la participación confirmada en ellas puede respaldarse con una
 * constancia. Por eso tienen pantalla propia.
 */
export default function AdminActivityCategoriesPage() {
  const { data, loading, error, reload } = useAsync<ActivityCategoryItem[]>(
    () => catalogService.activityCategories(),
    [],
  );
  const [form, setForm] = useState(vacia);
  const [codigoTocado, setCodigoTocado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ActivityCategoryItem | null>(null);
  const [query, setQuery] = useState('');
  const errores = useFormErrors(CAMPOS);
  const toast = useToast();
  const confirm = useConfirm();

  const visible = useMemo(() => {
    const q = suggestCode(query.trim()).replace(/_/g, ' ');
    const rows = data ?? [];
    if (!q) return rows;
    return rows.filter((c) =>
      [c.name, c.code, c.description ?? ''].some((f) => suggestCode(f).replace(/_/g, ' ').includes(q)),
    );
  }, [data, query]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglas(form);
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      await adminService.createActivityCategory(aPayload(form));
      toast.success('Categoría creada.', form.name.trim());
      setForm(vacia);
      setCodigoTocado(false);
      errores.reset();
      reload();
    } catch (e2) {
      errores.fromApi(e2);
    } finally {
      setSaving(false);
    }
  };

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
      toast.success(c.isActive ? 'Categoría dada de baja.' : 'Categoría reactivada.');
      reload();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <div>
      <PageHeader
        title="Categorías de actividad"
        description="Las que eligen la dirección de carrera y la sociedad científica al publicar una actividad. Si un estudiante participa, la participación confirmada y su constancia cuentan en su perfil."
      />

      <Card title="Nueva categoría">
        <form onSubmit={crear} noValidate>
          <FormAlert message={errores.general} />
          <CategoriaForm
            value={form}
            onChange={(v) => {
              if (v.code !== form.code && v.name === form.name) setCodigoTocado(true);
              setForm(v);
            }}
            errors={errores.errors}
            onFieldTouched={errores.clear}
            sugerirCodigo={!codigoTocado}
          />
          <Button type="submit" loading={saving} icon={<FiPlus size={15} />}>
            Crear categoría
          </Button>
        </form>
      </Card>

      <Card
        title="Categorías registradas"
        actions={
          (data ?? []).length > 0 ? (
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput value={query} onChange={setQuery} placeholder="Buscar categoría o código…" />
              <ResultCount shown={visible.length} total={(data ?? []).length} noun="categorías" />
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
          empty={<EmptyState icon={<FiLayers size={22} />} message="Todavía no hay categorías registradas." />}
        >
          {() =>
            visible.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ninguna categoría coincide con “${query}”.`}
                action={<Button variant="secondary" size="sm" onClick={() => setQuery('')}>Limpiar búsqueda</Button>}
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Aplica a</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((c) => (
                      <tr key={c.id} className={c.isActive ? '' : 'is-inactive'}>
                        <td>
                          <strong>{c.name}</strong>
                          {c.description && <div className="muted small">{c.description}</div>}
                        </td>
                        <td><code className="code-pill">{c.code}</code></td>
                        <td className="muted">{c.appliesTo ? lbl(ACTIVITY_TYPE_LABEL, c.appliesTo) : 'Ambos tipos'}</td>
                        <td>
                          <Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Vigente' : 'De baja'}</Badge>
                        </td>
                        <td>
                          <div className="flex" style={{ gap: '0.35rem' }}>
                            <Button variant="secondary" size="sm" icon={<FiEdit2 size={13} />} onClick={() => setEditing(c)}>
                              Editar
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => toggleActive(c)}>
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

      {editing && (
        <EditCategoriaDialog
          categoria={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success('Categoría actualizada.');
            reload();
          }}
        />
      )}
    </div>
  );
}

function EditCategoriaDialog({
  categoria,
  onClose,
  onSaved,
}: {
  categoria: ActivityCategoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<Campo, string>>({
    name: categoria.name,
    code: categoria.code,
    appliesTo: categoria.appliesTo ?? 'ambos',
    description: categoria.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglas(form);
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      await adminService.updateActivityCategory(categoria.id, aPayload(form));
      onSaved();
    } catch (e2) {
      errores.fromApi(e2);
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar categoría" subtitle={categoria.name} onClose={onClose} width={680}>
      <form onSubmit={submit} noValidate>
        <FormAlert message={errores.general} />
        <CategoriaForm
          value={form}
          onChange={setForm}
          errors={errores.errors}
          onFieldTouched={errores.clear}
          sugerirCodigo={false}
        />
        <div className="flex" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Guardar cambios</Button>
        </div>
      </form>
    </Modal>
  );
}
