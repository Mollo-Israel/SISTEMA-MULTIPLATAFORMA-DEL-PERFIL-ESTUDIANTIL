import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiEdit2, FiGrid, FiPlus, FiSearch, FiTool } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { adminService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { AcademicArea, Skill, SkillClassification } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, ResultCount, SearchInput,
  SkeletonTable, Tabs,
} from '../../components/ui';
import { FormAlert, FormField, useFormErrors } from '../../components/form';
import AiAssist from '../../components/AiAssist';
import { useConfirm, useToast } from '../../components/feedback';
import {
  catalogName, code as codeRule, optionalText, parseTags, skillName, suggestCode, tagList, validate,
} from '../../lib/validators';

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Áreas académicas y habilidades, en una sola pantalla.
 *
 * Van juntas porque se usan juntas: cada habilidad pertenece a un área, y las
 * dos son lo que el estudiante declara —lo que alimenta sus recomendaciones—.
 * Las categorías de actividad, en cambio, son de otra naturaleza (las elige
 * quien organiza, y lo que respaldan se demuestra), y siguen aparte.
 */
export default function AdminAreasSkillsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'skills' ? 'skills' : 'areas';
  const areas = useAsync(() => catalogService.areas(), []);
  const skills = useAsync(() => catalogService.skills(), []);

  return (
    <div>
      <PageHeader
        title="Áreas y habilidades"
        description="Lo que cada estudiante puede declarar: las áreas que le interesan y las tecnologías que maneja. Dar de baja algo no borra nada: solo deja de ofrecerse."
      />
      <Tabs
        items={[
          { key: 'areas', label: 'Áreas académicas', count: areas.data?.length },
          { key: 'skills', label: 'Habilidades', count: skills.data?.length },
        ]}
        value={tab}
        onChange={(k) => setParams(k === 'skills' ? { tab: 'skills' } : {}, { replace: true })}
      />
      {tab === 'areas' ? (
        <AreasPanel state={areas} onChanged={() => { areas.reload(); skills.reload(); }} />
      ) : (
        <SkillsPanel state={skills} areas={areas.data ?? []} onChanged={skills.reload} />
      )}
    </div>
  );
}

type Estado<T> = ReturnType<typeof useAsync<T>>;

// ===========================================================================
//  Áreas
// ===========================================================================

const CAMPOS_AREA = ['name', 'code', 'tags', 'description'] as const;
type CampoArea = (typeof CAMPOS_AREA)[number];
const areaVacia: Record<CampoArea, string> = { name: '', code: '', tags: '', description: '' };

function reglasArea(f: Record<CampoArea, string>) {
  return validate(f, {
    name: catalogName('del área'),
    code: codeRule,
    tags: tagList({ min: 1 }),
    description: optionalText(255),
  });
}

function AreaForm({
  value,
  onChange,
  errors,
  onFieldTouched,
  codeTouched,
  setCodeTouched,
}: {
  value: Record<CampoArea, string>;
  onChange: (v: Record<CampoArea, string>) => void;
  errors: Partial<Record<CampoArea, string>>;
  onFieldTouched: (c: CampoArea) => void;
  codeTouched: boolean;
  setCodeTouched: (b: boolean) => void;
}) {
  const set = (campo: CampoArea, v: string) => {
    const next = { ...value, [campo]: v };
    // El código sigue al nombre mientras nadie lo toque a mano.
    if (campo === 'name' && !codeTouched) next.code = suggestCode(v);
    onChange(next);
    onFieldTouched(campo);
  };
  return (
    <>
      <div className="row">
        <FormField label="Nombre" required error={errors.name} hint="Empieza por letra; puede llevar números (p. ej. «Industria 4.0»).">
          <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="Computación en la Nube" />
        </FormField>
        <FormField label="Código" required error={errors.code} hint="Se sugiere solo a partir del nombre. Lo identifica aunque el nombre cambie.">
          <input
            value={value.code}
            onChange={(e) => { setCodeTouched(true); set('code', e.target.value.toLowerCase()); }}
            placeholder="computacion_en_la_nube"
            className="mono"
          />
        </FormField>
      </div>
      <FormField
        label="Etiquetas"
        required
        error={errors.tags}
        hint="Separadas por coma. Son las palabras con las que el motor reconoce el área en proyectos, actividades y cursos."
      >
        <input value={value.tags} onChange={(e) => set('tags', e.target.value)} placeholder="aws, docker, kubernetes" />
      </FormField>
      {parseTags(value.tags).length > 0 && (
        <div className="tag-preview">
          {parseTags(value.tags).map((t) => <span key={t} className="tag-chip">{t}</span>)}
        </div>
      )}
      <FormField label="Descripción" error={errors.description} hint="Opcional.">
        <textarea
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Qué abarca esta área dentro de la carrera."
        />
      </FormField>
    </>
  );
}

/**
 * Antes de guardar, hace visible el riesgo de las etiquetas (V3 §9.4): las
 * genéricas no distinguen el área y las compartidas la confunden con otra. No
 * se prohíben —una etiqueta puede repetirse—, pero se confirman.
 * `previas` evita volver a preguntar por las que el área ya tenía.
 */
async function confirmarEtiquetas(
  confirm: ReturnType<typeof useConfirm>,
  tags: string[],
  exceptId?: string,
  previas: string[] = [],
): Promise<boolean> {
  let analisis;
  try {
    analisis = await adminService.analyzeAreaTags(tags, exceptId);
  } catch {
    return true; // Sin análisis no se bloquea: el servidor valida igual.
  }
  const antes = new Set(previas.map((t) => t.toLowerCase()));
  const genericas = analisis.generic.filter((t) => !antes.has(t));
  const compartidas = analisis.shared.filter((x) => !antes.has(x.tag));
  if (genericas.length === 0 && compartidas.length === 0) return true;
  const lineas = [
    ...genericas.map((t) => `«${t}» es demasiado general: casi cualquier tema de la carrera la usa.`),
    ...compartidas.map((x) => `«${x.tag}» ya la usa${x.areas.length > 1 ? 'n' : ''}: ${x.areas.map((a) => a.name).slice(0, 4).join(', ')}${x.areas.length > 4 ? '…' : ''}.`),
  ];
  return confirm({
    title: 'Revisa estas etiquetas',
    message: `${lineas.join(' ')} Las etiquetas ayudan a reconocer el área; si se repiten, las sugerencias pueden confundirla con otra. ¿Guardar de todas formas?`,
    confirmLabel: 'Guardar de todas formas',
  });
}

function AreasPanel({ state, onChanged }: { state: Estado<AcademicArea[]>; onChanged: () => void }) {
  const { data, loading, error } = state;
  const [form, setForm] = useState(areaVacia);
  const [codeTouched, setCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AcademicArea | null>(null);
  const [query, setQuery] = useState('');
  const errores = useFormErrors(CAMPOS_AREA);
  const toast = useToast();
  const confirm = useConfirm();

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const rows = data ?? [];
    if (!q) return rows;
    return rows.filter((a) =>
      [a.name, a.code, a.description ?? '', (a.tags ?? []).join(' ')].some((f) => normalize(f).includes(q)),
    );
  }, [data, query]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglasArea(form);
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    if (!(await confirmarEtiquetas(confirm, parseTags(form.tags)))) return;
    setSaving(true);
    try {
      await adminService.createArea({
        name: form.name.trim(),
        code: form.code.trim(),
        tags: parseTags(form.tags),
        description: form.description.trim() || undefined,
      });
      toast.success('Área creada.', form.name.trim());
      setForm(areaVacia);
      setCodeTouched(false);
      errores.reset();
      onChanged();
    } catch (e2) {
      errores.fromApi(e2);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (area: AcademicArea) => {
    if (area.isActive) {
      const ok = await confirm({
        title: `Dar de baja “${area.name}”`,
        message:
          'Dejará de ofrecerse al declarar intereses, proyectos y actividades. '
          + 'Lo ya registrado con esta área se conserva.',
        confirmLabel: 'Dar de baja',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await adminService.updateArea(area.id, { isActive: !area.isActive });
      toast.success(area.isActive ? 'Área dada de baja.' : 'Área reactivada.');
      onChanged();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <>
      <Card title="Nueva área académica">
        <form onSubmit={crear} noValidate>
          <FormAlert message={errores.general} />
          <AreaForm
            value={form}
            onChange={setForm}
            errors={errores.errors}
            onFieldTouched={errores.clear}
            codeTouched={codeTouched}
            setCodeTouched={setCodeTouched}
          />
          <Button type="submit" loading={saving} icon={<FiPlus size={15} />}>
            Crear área
          </Button>
        </form>
      </Card>

      <Card
        title="Áreas registradas"
        actions={
          (data ?? []).length > 0 ? (
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput value={query} onChange={setQuery} placeholder="Buscar nombre, código o etiqueta…" />
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
        >
          {() =>
            visible.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ningún área coincide con “${query}”.`}
                action={<Button variant="secondary" size="sm" onClick={() => setQuery('')}>Limpiar búsqueda</Button>}
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Etiquetas</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((a) => (
                      <tr key={a.id} className={a.isActive ? '' : 'is-inactive'}>
                        <td>
                          <strong>{a.name}</strong>
                          {a.description && <div className="muted small">{a.description}</div>}
                        </td>
                        <td><code className="code-pill">{a.code}</code></td>
                        <td>
                          {a.tags && a.tags.length > 0 ? (
                            <div className="tag-preview">
                              {a.tags.map((t) => <span key={t} className="tag-chip">{t}</span>)}
                            </div>
                          ) : (
                            <span className="link-warn" title="Sin etiquetas, el motor no reconoce el área">
                              <FiAlertTriangle size={13} /> Sin etiquetas
                            </span>
                          )}
                        </td>
                        <td>
                          <Badge tone={a.isActive ? 'green' : 'gray'}>{a.isActive ? 'Vigente' : 'De baja'}</Badge>
                        </td>
                        <td>
                          <div className="flex" style={{ gap: '0.35rem' }}>
                            <Button variant="secondary" size="sm" icon={<FiEdit2 size={13} />} onClick={() => setEditing(a)}>
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
              </div>
            )
          }
        </AsyncView>
      </Card>

      {editing && (
        <EditAreaDialog
          area={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success('Área actualizada.');
            onChanged();
          }}
        />
      )}
    </>
  );
}

function EditAreaDialog({ area, onClose, onSaved }: { area: AcademicArea; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<CampoArea, string>>({
    name: area.name,
    code: area.code,
    tags: (area.tags ?? []).join(', '),
    description: area.description ?? '',
  });
  const [codeTouched, setCodeTouched] = useState(true);
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS_AREA);
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglasArea(form);
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    if (!(await confirmarEtiquetas(confirm, parseTags(form.tags), area.id, area.tags ?? []))) return;
    setSaving(true);
    try {
      await adminService.updateArea(area.id, {
        name: form.name.trim(),
        code: form.code.trim(),
        tags: parseTags(form.tags),
        description: form.description.trim(),
      });
      onSaved();
    } catch (e2) {
      errores.fromApi(e2);
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar área académica" subtitle={area.name} onClose={onClose} width={620}>
      <form onSubmit={submit} noValidate>
        <FormAlert message={errores.general} />
        <AreaForm
          value={form}
          onChange={setForm}
          errors={errores.errors}
          onFieldTouched={errores.clear}
          codeTouched={codeTouched}
          setCodeTouched={setCodeTouched}
        />
        <div className="flex" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Guardar cambios</Button>
        </div>
      </form>
    </Modal>
  );
}

// ===========================================================================
//  Habilidades
// ===========================================================================

const CAMPOS_SKILL = ['name', 'code', 'academicAreaId', 'aliases', 'overrideReason'] as const;
type CampoSkill = (typeof CAMPOS_SKILL)[number];
const skillVacia: Record<CampoSkill, string> = { name: '', code: '', academicAreaId: '', aliases: '', overrideReason: '' };

const aliasesDe = (v: string) => v.split(',').map((a) => a.trim()).filter(Boolean);

function reglasSkill(f: Record<CampoSkill, string>) {
  return validate(f, {
    name: skillName,
    code: codeRule,
    academicAreaId: (v) => (v ? null : 'Elige el área: es la que recibe el puntaje de esta habilidad.'),
    aliases: (v) => {
      const lista = aliasesDe(v);
      if (lista.length > 10) return 'Como máximo 10 alias.';
      const malo = lista.find((a) => skillName(a));
      return malo ? `«${malo}» no es un nombre de tecnología válido.` : null;
    },
    overrideReason: (v) => (v.trim() && v.trim().length < 10 ? 'Explica el motivo en al menos 10 caracteres.' : null),
  });
}

/** Cuerpo de alta/edición: alias como lista y el motivo solo si se escribió. */
function cuerpoSkill(f: Record<CampoSkill, string>) {
  return {
    name: f.name.trim(),
    code: f.code.trim(),
    academicAreaId: f.academicAreaId,
    aliases: aliasesDe(f.aliases),
    ...(f.overrideReason.trim() ? { overrideReason: f.overrideReason.trim() } : {}),
  };
}

/**
 * Clasificación sugerida en vivo (V2 §23.3): regla canónica o coincidencia
 * por etiquetas. Se pide al servidor, que es quien decide al guardar.
 */
function useClasificacion(nombre: string, aliases: string) {
  const [c, setC] = useState<SkillClassification | null>(null);
  useEffect(() => {
    const n = nombre.trim();
    if (n.length < 2) {
      setC(null);
      return;
    }
    const t = setTimeout(() => {
      adminService.classifySkill(n, aliasesDe(aliases)).then(setC).catch(() => setC(null));
    }, 350);
    return () => clearTimeout(t);
  }, [nombre, aliases]);
  return c;
}

function SkillForm({
  value,
  onChange,
  errors,
  onFieldTouched,
  areas,
  codeTouched,
  setCodeTouched,
}: {
  value: Record<CampoSkill, string>;
  onChange: (v: Record<CampoSkill, string>) => void;
  errors: Partial<Record<CampoSkill, string>>;
  onFieldTouched: (c: CampoSkill) => void;
  areas: AcademicArea[];
  codeTouched: boolean;
  setCodeTouched: (b: boolean) => void;
}) {
  const set = (campo: CampoSkill, v: string) => {
    const next = { ...value, [campo]: v };
    if (campo === 'name' && !codeTouched) next.code = suggestCode(v);
    onChange(next);
    onFieldTouched(campo);
  };
  const clasificacion = useClasificacion(value.name, value.aliases);
  const fuera = !!clasificacion && clasificacion.rule !== 'none' && !!value.academicAreaId
    && !clasificacion.areaIds.includes(value.academicAreaId);
  return (
    <>
    <div className="row">
      <FormField label="Nombre" required error={errors.name} hint="El nombre de la tecnología: «React», «C#», «Node.js».">
        <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="GraphQL" />
      </FormField>
      <FormField label="Código" required error={errors.code}>
        <input
          value={value.code}
          onChange={(e) => { setCodeTouched(true); set('code', e.target.value.toLowerCase()); }}
          placeholder="graphql"
          className="mono"
        />
      </FormField>
      <FormField label="Área académica" required error={errors.academicAreaId} hint="La que recibe el puntaje en el motor.">
        <select value={value.academicAreaId} onChange={(e) => set('academicAreaId', e.target.value)}>
          <option value="">Elige el área…</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}{a.isActive ? '' : ' (de baja)'}</option>
          ))}
        </select>
      </FormField>
    </div>
    {clasificacion?.rule === 'none' && value.name.trim().length >= 2 && (
      <AiAssist
        task="TAG_SUGGESTION"
        label="Sugerir área con IA"
        request={() => ({ target: 'skill', text: value.name })}
        render={(r) => (
          <p style={{ margin: 0 }}>
            <strong>{r.areaName}</strong>{r.reason ? ` — ${r.reason}` : ''}
          </p>
        )}
        onUse={(r) => r.areaId && set('academicAreaId', r.areaId)}
        useLabel="Usar esta área"
      />
    )}
    <FormField label="Alias" error={errors.aliases} hint="Otros nombres de la misma tecnología, separados por coma: «ReactJS, React.js».">
      <input value={value.aliases} onChange={(e) => set('aliases', e.target.value)} placeholder="ReactJS, React.js" />
    </FormField>
    {clasificacion && clasificacion.rule !== 'none' && (
      <div className={`notice ${fuera ? (clasificacion.rule === 'canonical' ? 'notice-error' : 'notice-warn') : 'notice-info'}`}>
        <FiAlertTriangle size={18} />
        <div>
          <strong>{clasificacion.rule === 'canonical' ? 'Regla del catálogo' : 'Sugerencia'}:</strong> {clasificacion.reason}
          {fuera && clasificacion.rule === 'canonical' && ' No se podrá guardar en otra área.'}
          {!value.academicAreaId || fuera ? (
            <div style={{ marginTop: '0.35rem' }}>
              {clasificacion.areaIds.map((id, i) => (
                <Button key={id} type="button" size="sm" variant="secondary" onClick={() => set('academicAreaId', id)}>
                  Usar {clasificacion.areaNames[i]}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )}
    {(fuera && clasificacion?.rule === 'suggested') || errors.overrideReason ? (
      <FormField label="Motivo para guardarla en esta área" error={errors.overrideReason} hint="Queda registrado en la auditoría.">
        <textarea value={value.overrideReason} onChange={(e) => set('overrideReason', e.target.value)} placeholder="Por qué pertenece al área elegida…" />
      </FormField>
    ) : null}
    </>
  );
}

function SkillsPanel({
  state,
  areas,
  onChanged,
}: {
  state: Estado<Skill[]>;
  areas: AcademicArea[];
  onChanged: () => void;
}) {
  const { data, loading, error } = state;
  const [form, setForm] = useState(skillVacia);
  const [codeTouched, setCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [query, setQuery] = useState('');
  const errores = useFormErrors(CAMPOS_SKILL);
  const toast = useToast();
  const confirm = useConfirm();

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const rows = data ?? [];
    if (!q) return rows;
    return rows.filter((s) => [s.name, s.code, s.academicArea?.name ?? ''].some((f) => normalize(f).includes(q)));
  }, [data, query]);

  const sinArea = (data ?? []).filter((s) => !s.academicAreaId).length;

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglasSkill(form);
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      await adminService.createSkill(cuerpoSkill(form));
      toast.success('Habilidad creada.', form.name.trim());
      setForm({ ...skillVacia, academicAreaId: form.academicAreaId });
      setCodeTouched(false);
      errores.reset();
      onChanged();
    } catch (e2) {
      errores.fromApi(e2);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (skill: Skill) => {
    if (skill.isActive) {
      const ok = await confirm({
        title: `Dar de baja “${skill.name}”`,
        message: 'Dejará de ofrecerse al declarar habilidades. Quien ya la tiene declarada la conserva.',
        confirmLabel: 'Dar de baja',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await adminService.updateSkill(skill.id, { isActive: !skill.isActive });
      toast.success(skill.isActive ? 'Habilidad dada de baja.' : 'Habilidad reactivada.');
      onChanged();
    } catch (e2) {
      toast.error(apiError(e2));
    }
  };

  return (
    <>
      {sinArea > 0 && (
        <div className="notice notice-warn">
          <FiAlertTriangle size={18} />
          <div>
            <strong>{sinArea === 1 ? 'Hay 1 habilidad sin área.' : `Hay ${sinArea} habilidades sin área.`}</strong>{' '}
            Sin área no suman en el motor. Edítalas para asignarles una.
          </div>
        </div>
      )}
      <Card title="Nueva habilidad">
        <form onSubmit={crear} noValidate>
          <FormAlert message={errores.general} />
          <SkillForm
            value={form}
            onChange={setForm}
            errors={errores.errors}
            onFieldTouched={errores.clear}
            areas={areas.filter((a) => a.isActive)}
            codeTouched={codeTouched}
            setCodeTouched={setCodeTouched}
          />
          <Button type="submit" loading={saving} icon={<FiPlus size={15} />}>
            Crear habilidad
          </Button>
        </form>
      </Card>

      <Card
        title="Habilidades registradas"
        actions={
          (data ?? []).length > 0 ? (
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              <SearchInput value={query} onChange={setQuery} placeholder="Buscar habilidad, código o área…" />
              <ResultCount shown={visible.length} total={(data ?? []).length} noun="habilidades" />
            </div>
          ) : undefined
        }
      >
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          skeleton={<SkeletonTable rows={6} columns={5} />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState icon={<FiTool size={22} />} message="Todavía no hay habilidades en el catálogo." />}
        >
          {() =>
            visible.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ninguna habilidad coincide con “${query}”.`}
                action={<Button variant="secondary" size="sm" onClick={() => setQuery('')}>Limpiar búsqueda</Button>}
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Habilidad</th>
                      <th>Código</th>
                      <th>Área</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => (
                      <tr key={s.id} className={s.isActive ? '' : 'is-inactive'}>
                        <td><strong>{s.name}</strong></td>
                        <td><code className="code-pill">{s.code}</code></td>
                        <td>
                          {s.academicArea?.name ?? (
                            <button type="button" className="link-warn" onClick={() => setEditing(s)}>
                              <FiAlertTriangle size={13} /> Asignar área
                            </button>
                          )}
                        </td>
                        <td>
                          <Badge tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'Vigente' : 'De baja'}</Badge>
                        </td>
                        <td>
                          <div className="flex" style={{ gap: '0.35rem' }}>
                            <Button variant="secondary" size="sm" icon={<FiEdit2 size={13} />} onClick={() => setEditing(s)}>
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
              </div>
            )
          }
        </AsyncView>
      </Card>

      {editing && (
        <EditSkillDialog
          skill={editing}
          areas={areas}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success('Habilidad actualizada.');
            onChanged();
          }}
        />
      )}
    </>
  );
}

function EditSkillDialog({
  skill,
  areas,
  onClose,
  onSaved,
}: {
  skill: Skill;
  areas: AcademicArea[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<CampoSkill, string>>({
    name: skill.name,
    code: skill.code,
    academicAreaId: skill.academicAreaId ?? '',
    aliases: (skill.aliases ?? []).join(', '),
    overrideReason: '',
  });
  const [codeTouched, setCodeTouched] = useState(true);
  const [saving, setSaving] = useState(false);
  const errores = useFormErrors(CAMPOS_SKILL);

  // Si el área de la habilidad está de baja, sigue apareciendo en el selector
  // para no perderla al abrir la edición.
  const opciones = useMemo(() => {
    const propia = areas.find((a) => a.id === skill.academicAreaId);
    return propia && !propia.isActive ? [...areas.filter((a) => a.isActive), propia] : areas;
  }, [areas, skill.academicAreaId]);

  useEffect(() => {
    if (!skill.academicAreaId) errores.setErrors({ academicAreaId: 'Esta habilidad no tiene área: asígnale una para que cuente en el motor.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locales = reglasSkill(form);
    if (Object.keys(locales).length) {
      errores.setErrors(locales);
      return;
    }
    setSaving(true);
    try {
      await adminService.updateSkill(skill.id, cuerpoSkill(form));
      onSaved();
    } catch (e2) {
      errores.fromApi(e2);
      setSaving(false);
    }
  };

  return (
    <Modal title="Editar habilidad" subtitle={skill.name} onClose={onClose} width={620}>
      <form onSubmit={submit} noValidate>
        <FormAlert message={errores.general} />
        <SkillForm
          value={form}
          onChange={setForm}
          errors={errores.errors}
          onFieldTouched={errores.clear}
          areas={opciones}
          codeTouched={codeTouched}
          setCodeTouched={setCodeTouched}
        />
        <div className="flex" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Guardar cambios</Button>
        </div>
      </form>
    </Modal>
  );
}
