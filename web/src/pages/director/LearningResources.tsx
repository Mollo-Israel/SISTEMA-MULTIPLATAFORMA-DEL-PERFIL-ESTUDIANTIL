import { validarFormulario } from '../../components/form';
import { useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiExternalLink, FiPlus, FiSave, FiSearch, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { catalogService, learningResourceService } from '../../services';
import type { LearningResource } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { AcademicArea, Skill } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonTable,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const TIPOS: { value: string; label: string; ayuda: string }[] = [
  { value: 'external_course', label: 'Curso externo', ayuda: 'De una plataforma o institución externa.' },
  { value: 'practice', label: 'Práctica o reto', ayuda: 'Ejercicios o laboratorios para construir experiencia.' },
  { value: 'tool', label: 'Herramienta', ayuda: 'Entorno o utilidad con la que practicar.' },
  { value: 'guide', label: 'Guía o tutorial', ayuda: 'Material explicativo paso a paso.' },
  { value: 'documentation', label: 'Documentación', ayuda: 'Referencia oficial de una tecnología.' },
  { value: 'video', label: 'Video', ayuda: 'Video o serie de videos.' },
  { value: 'book', label: 'Libro', ayuda: 'Libro o capítulo.' },
];

const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]));

const vacio = {
  title: '',
  provider: '',
  url: '',
  description: '',
  academicAreaId: '',
  resourceType: 'guide',
  skillIds: [] as string[],
};

/**
 * Catálogo controlado de recursos y cursos externos (§61).
 *
 * §61 prohíbe recomendar URLs recogidas automáticamente de Internet: un
 * recurso entra porque alguien de la carrera lo revisó y decidió incluirlo.
 * Esta pantalla es ese «alguien». Sin ella, la regla existiría solo en la API y
 * el catálogo se quedaría con lo que trajo la migración.
 */
export default function DirectorLearningResourcesPage() {
  const [verRetirados, setVerRetirados] = useState(false);
  const state = useAsync(
    () => learningResourceService.list({ includeInactive: verRetirados }),
    [verRetirados],
  );
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [form, setForm] = useState(vacio);
  const [editing, setEditing] = useState<LearningResource | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    catalogService.areas().then(setAreas).catch(() => {});
    catalogService.skills().then(setSkills).catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const rows = state.data ?? [];
    if (!q) return rows;
    return rows.filter((r) =>
      [r.title, r.provider, r.academicArea?.name ?? '', r.url].some((f) =>
        normalize(f).includes(q),
      ),
    );
  }, [state.data, query]);

  const skillsDelArea = useMemo(
    () => skills.filter((s) => !form.academicAreaId || s.academicAreaId === form.academicAreaId),
    [skills, form.academicAreaId],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // V3 §67: error debajo de cada campo, no el globo del navegador.
    if (!validarFormulario(e.currentTarget as HTMLFormElement)) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        provider: form.provider,
        url: form.url,
        description: form.description || undefined,
        academicAreaId: form.academicAreaId,
        resourceType: form.resourceType,
        skillIds: form.skillIds,
      };
      if (editing) {
        await learningResourceService.update(editing.id, payload);
        toast.success('Recurso actualizado.');
      } else {
        await learningResourceService.create(payload);
        toast.success(
          'Recurso incorporado al catálogo.',
          'Desde ahora puede recomendarse a los estudiantes del área.',
        );
      }
      setForm(vacio);
      setEditing(null);
      state.reload();
    } catch (e2) {
      toast.error(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  const editar = (r: LearningResource) => {
    setEditing(r);
    setForm({
      title: r.title,
      provider: r.provider,
      url: r.url,
      description: r.description ?? '',
      academicAreaId: r.academicAreaId,
      resourceType: r.resourceType,
      skillIds: (r.resourceSkills ?? []).map((s) => s.skillId),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cambiarEstado = async (r: LearningResource) => {
    const retirar = r.status === 'active';
    if (retirar) {
      const ok = await confirm({
        title: `Retirar “${r.title}”`,
        message:
          'Dejará de recomendarse a los estudiantes. No se borra: se conserva para que las '
          + 'recomendaciones anteriores puedan seguir explicando a qué apuntaban.',
        confirmLabel: 'Retirar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await learningResourceService.update(r.id, { status: retirar ? 'inactive' : 'active' });
      toast.success(retirar ? 'Recurso retirado.' : 'Recurso repuesto en el catálogo.');
      state.reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const tipoActual = TIPOS.find((t) => t.value === form.resourceType);

  return (
    <div>
      <PageHeader
        title="Catálogo de recursos y cursos"
        description="Material que el motor puede recomendar. Solo se recomienda lo que está aquí: nunca enlaces recogidos automáticamente de Internet."
      />

      <Card title={editing ? `Editar “${editing.title}”` : 'Incorporar un recurso'}>
        <form noValidate onSubmit={submit}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="learning-resources-titulo">Título</label>
              <input id="learning-resources-titulo"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Curso de fundamentos de redes"
                maxLength={200}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="learning-resources-quien-lo-publica">Quién lo publica</label>
              <input id="learning-resources-quien-lo-publica"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                placeholder="Cisco Networking Academy"
                maxLength={160}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="learning-resources-enlace">Enlace</label>
            <input id="learning-resources-enlace"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://…"
              maxLength={500}
              required
            />
            <span className="field-hint">Solo http o https.</span>
          </div>

          <div className="field">
            <label htmlFor="learning-resources-descripcion">Descripción</label>
            <textarea id="learning-resources-descripcion"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Qué cubre y para quién es útil."
              maxLength={500}
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="learning-resources-area-academica">Área académica</label>
              <select id="learning-resources-area-academica"
                value={form.academicAreaId}
                onChange={(e) =>
                  setForm({ ...form, academicAreaId: e.target.value, skillIds: [] })}
                required
              >
                <option value="">Seleccione…</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="learning-resources-tipo">Tipo</label>
              <select id="learning-resources-tipo"
                value={form.resourceType}
                onChange={(e) => setForm({ ...form, resourceType: e.target.value })}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {tipoActual && <span className="field-hint">{tipoActual.ayuda}</span>}
            </div>
          </div>

          <div className="field">
            <span className="field-label" id="learning-resources-habilidades">Habilidades que trabaja</span>
            <p className="muted" style={{ marginTop: 0, fontSize: '0.78rem' }}>
              Opcional. Permite recomendarlo a quien declaró esa habilidad, y no solo por área.
            </p>
            <div className="chip-row" role="group" aria-labelledby="learning-resources-habilidades">
              {skillsDelArea.slice(0, 40).map((s) => {
                const on = form.skillIds.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    className={`chip ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() => setForm({
                      ...form,
                      skillIds: on
                        ? form.skillIds.filter((x) => x !== s.id)
                        : [...form.skillIds, s.id],
                    })}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex" style={{ gap: '0.6rem' }}>
            <Button type="submit" loading={saving} icon={editing ? <FiSave size={15} /> : <FiPlus size={15} />}>
              {editing ? 'Guardar cambios' : 'Incorporar al catálogo'}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="secondary"
                icon={<FiX size={15} />}
                onClick={() => { setEditing(null); setForm(vacio); }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card
        title="Recursos del catálogo"
        actions={
          <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
            <label className="flex" style={{ gap: '0.4rem', fontSize: '0.82rem' }}>
              <input
                type="checkbox"
                checked={verRetirados}
                onChange={(e) => setVerRetirados(e.target.checked)}
              />
              Ver también los retirados
            </label>
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar recurso…" />
            <ResultCount shown={visible.length} total={(state.data ?? []).length} noun="recursos" />
          </div>
        }
      >
        <AsyncView
          loading={state.loading}
          error={state.error}
          data={state.data}
          skeleton={<SkeletonTable rows={5} columns={5} />}
        >
          {() =>
            visible.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={
                  query
                    ? `Ningún recurso coincide con “${query}”.`
                    : 'El catálogo todavía está vacío. Incorpora el primer recurso arriba.'
                }
              />
            ) : (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Recurso</th>
                      <th>Área</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="flex" style={{ gap: '0.4rem' }}>
                            <FiBookOpen size={13} /> {r.title}
                          </div>
                          <a
                            className="muted"
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            style={{ fontSize: '0.78rem' }}
                          >
                            {r.provider} <FiExternalLink size={11} />
                          </a>
                        </td>
                        <td className="muted">{r.academicArea?.name ?? '—'}</td>
                        <td className="muted">{TIPO_LABEL[r.resourceType] ?? r.resourceType}</td>
                        <td>
                          <Badge tone={r.status === 'active' ? 'green' : 'gray'}>
                            {r.status === 'active' ? 'Vigente' : 'Retirado'}
                          </Badge>
                        </td>
                        <td>
                          <div className="flex" style={{ gap: '0.4rem' }}>
                            <Button size="sm" variant="secondary" onClick={() => editar(r)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant={r.status === 'active' ? 'danger' : 'secondary'}
                              onClick={() => cambiarEstado(r)}
                            >
                              {r.status === 'active' ? 'Retirar' : 'Reponer'}
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
