import { validarFormulario } from '../../components/form';
import { BotonArchivo, ImagenProtegida } from '../../components/ArchivoProtegido';
import { useEffect, useMemo, useState } from 'react';
import AreaSkillPicker from '../../components/AreaSkillPicker';
import { FiBookOpen, FiExternalLink, FiFileText, FiPlus, FiSave, FiSearch, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { catalogService, learningResourceService, uploadService } from '../../services';
import type { LearningResource } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import type { AcademicArea, Skill } from '../../services/types';
import {
  AsyncView, Badge, Button, Card, EmptyState, FILAS_POR_PAGINA, PageHeader, Paginacion, ResultCount, SearchInput,
  SkeletonTable, ThOrden, useOrden, usePaginacion,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { useAuth } from '../../auth/AuthContext';
import { activityService, approvalPolicyService } from '../../services';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const TIPOS: { value: string; label: string; ayuda: string }[] = [
  // V5 §8: un curso libre es material; el que otorga una credencial es una
  // oportunidad externa y no se registra aquí.
  {
    value: 'external_course',
    label: 'Curso de autoaprendizaje (sin acreditación automática)',
    ayuda: 'Curso libre para aprender por cuenta propia. Verlo no certifica nada; un curso con credencial es una oportunidad externa.',
  },
  { value: 'practice', label: 'Práctica o reto', ayuda: 'Ejercicios o laboratorios para construir experiencia.' },
  { value: 'tool', label: 'Herramienta', ayuda: 'Entorno o utilidad con la que practicar.' },
  { value: 'guide', label: 'Guía o tutorial', ayuda: 'Material explicativo paso a paso.' },
  { value: 'documentation', label: 'Documentación', ayuda: 'Referencia oficial de una tecnología.' },
  { value: 'video', label: 'Video', ayuda: 'Video o serie de videos.' },
  { value: 'book', label: 'Libro', ayuda: 'Libro o capítulo.' },
];

const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]));

/** V5-6 (§8.2): semestres de la carrera que Dirección puede elegir. */
const SEMESTRES_CARRERA = [1, 2, 3, 4, 5, 6, 7, 8];

/** V5-6 (§8.1): material que se puede subir. Un video va por enlace. */
const ACEPTA_MATERIAL = 'application/pdf,image/png,image/jpeg,image/webp';

/** V4.1 A41-014: estado de la revisión de una propuesta docente. */
const REVISION_LABEL: Record<string, string> = {
  pending: 'En revisión', observed: 'Observado', approved: 'Aprobado', rejected: 'Rechazado',
};
const REVISION_TONO: Record<string, string> = {
  pending: 'amber', observed: 'amber', approved: 'green', rejected: 'red',
};

const vacio = {
  title: '',
  provider: '',
  url: '',
  /** V5-6 (§8.1): material subido; el recurso necesita enlace, archivo o ambos. */
  fileId: '',
  fileName: '',
  description: '',
  academicAreaId: '',
  resourceType: 'guide',
  skillIds: [] as string[],
  /** V3.2 §35: varias áreas (la primera es la principal) e imagen opcional. */
  areaIds: [] as string[],
  imageFileId: '',
  imageUrl: '',
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
  const { user } = useAuth();
  // V4.1 A41-014 (§7): el docente propone para sus semestres y Dirección revisa.
  const esDocente = user?.role === 'TEACHER';
  const [semestresDocente, setSemestresDocente] = useState<number[]>([]);
  const [semestres, setSemestres] = useState<number[]>([]);
  // V5-6 (§8.2): Dirección y Administración eligen toda la carrera o semestres.
  const [alcance, setAlcance] = useState<'carrera' | 'semestres'>('carrera');
  const [subiendo, setSubiendo] = useState(false);
  const pendientes = useAsync(() => (esDocente ? Promise.resolve([]) : learningResourceService.pending()), [esDocente]);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  // V5 §9.2: con autonomía de Dirección, el docente publica sin revisión.
  const [directo, setDirecto] = useState(false);
  useEffect(() => {
    if (esDocente) activityService.myScope().then((r) => setSemestresDocente(r.semesters)).catch(() => {});
    if (esDocente) approvalPolicyService.mine().then((p) => setDirecto(p.RESOURCE === 'DIRECT_ALLOWED')).catch(() => {});
  }, [esDocente]);
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
      [r.title, r.provider, r.academicArea?.name ?? '', r.url ?? '', r.fileName ?? ''].some((f) =>
        normalize(f).includes(q),
      ),
    );
  }, [state.data, query]);

  // V4.1 A41-003: orden por columna y 10 filas por página.
  const { ordenados, orden, alternar } = useOrden(visible, {
    recurso: (r) => r.title,
    area: (r) => r.academicArea?.name ?? '',
    tipo: (r) => TIPO_LABEL[r.resourceType] ?? r.resourceType,
    estado: (r) => (r.status === 'active' ? 0 : 1),
  }, { clave: 'recurso', dir: 'asc' });
  const pag = usePaginacion(ordenados, FILAS_POR_PAGINA, [query, verRetirados, orden]);

  const skillsDelArea = useMemo(
    () => skills.filter((s) => !form.academicAreaId || s.academicAreaId === form.academicAreaId),
    [skills, form.academicAreaId],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // V3 §67: error debajo de cada campo, no el globo del navegador.
    if (!validarFormulario(e.currentTarget as HTMLFormElement)) return;
    if (form.areaIds.length === 0) {
      toast.error('Selecciona al menos un área para el recurso.');
      return;
    }
    if (!esDocente && alcance === 'semestres' && semestres.length === 0) {
      toast.error('Marca al menos un semestre, o elige «Toda la carrera».');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        provider: form.provider,
        url: form.url.trim() || (editing ? null : undefined),
        fileId: form.fileId || (editing ? null : undefined),
        description: form.description || undefined,
        academicAreaId: form.areaIds[0] ?? form.academicAreaId,
        areaIds: form.areaIds,
        resourceType: form.resourceType,
        skillIds: form.skillIds,
        imageFileId: form.imageFileId || (editing ? null : undefined),
        ...(esDocente && !editing ? { semesterScope: semestres } : {}),
        ...(!esDocente ? { semesterScope: alcance === 'carrera' ? [] : semestres } : {}),
      };
      if (editing) {
        await learningResourceService.update(editing.id, payload);
        toast.success('Recurso actualizado.');
      } else {
        await learningResourceService.create(payload);
        const propone = esDocente && !directo;
        toast.success(
          propone ? 'Propuesta enviada a Dirección.' : 'Recurso incorporado al catálogo.',
          propone ? 'Aparecerá en la Biblioteca cuando Dirección la apruebe.' : esDocente ? 'Ya está en la Biblioteca; Dirección lo ve en su historial.' : 'Desde ahora puede recomendarse a los estudiantes del área.',
        );
      }
      setForm(vacio);
      setEditing(null);
      setAlcance('carrera');
      setSemestres([]);
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
      url: r.url ?? '',
      fileId: r.fileId ?? '',
      fileName: r.fileName ?? (r.fileId ? 'Archivo adjunto' : ''),
      description: r.description ?? '',
      academicAreaId: r.academicAreaId,
      resourceType: r.resourceType,
      skillIds: (r.resourceSkills ?? []).map((s) => s.skillId),
      areaIds: r.areaIds ?? [r.academicAreaId],
      imageFileId: r.imageFileId ?? '',
      imageUrl: r.imageUrl ?? '',
    });
    setAlcance(r.semesterScope?.length ? 'semestres' : 'carrera');
    setSemestres(r.semesterScope ?? []);
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

  /** V4.1 A41-014 (§9.4): decisión de Dirección sobre una propuesta. */
  const revisar = async (id: string, decision: 'approve' | 'observe' | 'reject') => {
    const comentario = (comentarios[id] ?? '').trim();
    if (decision !== 'approve' && !comentario) {
      toast.error('Escribe un comentario: explica qué corregir o por qué se rechaza.');
      return;
    }
    try {
      await learningResourceService.review(id, decision, comentario || undefined);
      toast.success(decision === 'approve' ? 'Recurso aprobado: ya está en la Biblioteca.' : decision === 'observe' ? 'Observado: vuelve al docente.' : 'Rechazado.');
      pendientes.reload();
      state.reload();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const tipoActual = TIPOS.find((t) => t.value === form.resourceType);

  return (
    <div>
      <PageHeader
        title={esDocente ? (directo ? 'Publicar recursos' : 'Proponer recursos') : 'Catálogo de recursos y cursos'}
        description={esDocente
          ? directo
            ? 'Dirección te concedió publicar material para tus semestres sin revisión. Queda registrado y Dirección lo ve.'
            : 'Propón material para tus semestres. Dirección lo revisa antes de que llegue a la Biblioteca.'
          : 'Material que el motor puede recomendar. Solo se recomienda lo que está aquí: nunca enlaces recogidos automáticamente de Internet.'}
      />

      {!esDocente && (pendientes.data ?? []).length > 0 && (
        <Card title={`Pendientes de revisión (${(pendientes.data ?? []).length})`}>
          <ul className="review-list">
            {(pendientes.data ?? []).map((r) => (
              <li key={r.id} data-testid="recurso-pendiente">
                <div>
                  <strong>{r.title}</strong> <span className="muted small">· {r.provider} · {r.academicArea?.name ?? ''}</span>
                  <div className="muted small">
                    {r.semesterScope?.length ? `Para ${r.semesterScope.map((n) => `${n}.º`).join(', ')}` : 'Toda la carrera'}
                    {r.url && <>{' · '}<a href={r.url} target="_blank" rel="noreferrer noopener">Abrir enlace</a></>}
                    {r.fileUrl && <>{' · '}<BotonArchivo src={r.fileUrl} nombre={r.fileName ?? 'material'} className="link-button">Ver archivo</BotonArchivo></>}
                  </div>
                </div>
                <input
                  aria-label={`Comentario para «${r.title}»`}
                  placeholder="Comentario (obligatorio para observar o rechazar)"
                  value={comentarios[r.id] ?? ''}
                  onChange={(e) => setComentarios({ ...comentarios, [r.id]: e.target.value })}
                  maxLength={500}
                />
                <div className="flex" style={{ gap: '0.35rem' }}>
                  <Button size="sm" onClick={() => void revisar(r.id, 'approve')}>Aprobar</Button>
                  <Button size="sm" variant="secondary" onClick={() => void revisar(r.id, 'observe')}>Observar</Button>
                  <Button size="sm" variant="danger" onClick={() => void revisar(r.id, 'reject')}>Rechazar</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={editing ? `Editar “${editing.title}”` : esDocente && !directo ? 'Proponer un recurso' : esDocente ? 'Publicar un recurso' : 'Incorporar un recurso'}>
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
                pattern=".*[A-Za-zÀ-ÖØ-öø-ÿ].*[A-Za-zÀ-ÖØ-öø-ÿ].*"
                title="El título tiene que tener palabras, no solo números o signos."
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
                pattern=".*[A-Za-zÀ-ÖØ-öø-ÿ].*[A-Za-zÀ-ÖØ-öø-ÿ].*"
                title="Quién publica tiene que tener palabras, no solo números o signos."
              />
            </div>
          </div>

          {esDocente && !editing && (
            <div className="field">
              <span className="field-label" id="lr-semestres">Semestres a los que va dirigido</span>
              <div role="group" aria-labelledby="lr-semestres" className="chip-row">
                {semestresDocente.map((n) => {
                  const on = semestres.includes(n);
                  return (
                    <button type="button" key={n} className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                      onClick={() => setSemestres(on ? semestres.filter((x) => x !== n) : [...semestres, n].sort((x, y) => x - y))}>
                      {n}º
                    </button>
                  );
                })}
              </div>
              <small className="muted">Sin marcar ninguno, va a todos tus semestres.</small>
            </div>
          )}

          {!esDocente && (
            <div className="field">
              <span className="field-label" id="lr-alcance">Para quién es</span>
              <div role="radiogroup" aria-labelledby="lr-alcance" className="flex" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                <label className="flex" style={{ gap: '0.35rem' }}>
                  <input type="radio" name="lr-alcance" checked={alcance === 'carrera'} onChange={() => setAlcance('carrera')} />
                  Toda la carrera
                </label>
                <label className="flex" style={{ gap: '0.35rem' }}>
                  <input type="radio" name="lr-alcance" checked={alcance === 'semestres'} onChange={() => setAlcance('semestres')} />
                  Semestres específicos
                </label>
              </div>
              {alcance === 'semestres' && (
                <div role="group" aria-label="Semestres" className="chip-row">
                  {SEMESTRES_CARRERA.map((n) => {
                    const on = semestres.includes(n);
                    return (
                      <button type="button" key={n} className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                        onClick={() => setSemestres(on ? semestres.filter((x) => x !== n) : [...semestres, n].sort((x, y) => x - y))}>
                        {n}º
                      </button>
                    );
                  })}
                </div>
              )}
              <small className="muted">
                {alcance === 'carrera' ? 'Lo ve todo estudiante de la carrera en la Biblioteca.' : 'Solo lo ven los estudiantes de los semestres marcados.'}
              </small>
            </div>
          )}

          {/* V5-6 (§8.1): un recurso tiene una fuente real: un enlace, un archivo o ambos. */}
          <fieldset className="field">
            <legend className="field-label">Material</legend>
            <div className="field">
              <label htmlFor="learning-resources-enlace">Enlace</label>
              <input id="learning-resources-enlace"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://…"
                maxLength={500}
                required={!form.fileId}
              />
              <span className="field-hint">
                {form.fileId ? 'Opcional: ya hay un archivo.' : 'Solo http o https. Si no hay enlace, sube el archivo.'}
              </span>
            </div>
            <div className="field">
              <label htmlFor="learning-resources-archivo">Archivo (PDF o imagen)</label>
              {form.fileId ? (
                <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }} data-testid="recurso-archivo">
                  <FiFileText size={15} aria-hidden /> <span>{form.fileName || 'Archivo adjunto'}</span>
                  <Button type="button" size="sm" variant="secondary" icon={<FiX size={13} />}
                    onClick={() => setForm({ ...form, fileId: '', fileName: '' })}>
                    Quitar archivo
                  </Button>
                </div>
              ) : (
                <input
                  id="learning-resources-archivo"
                  type="file"
                  accept={ACEPTA_MATERIAL}
                  disabled={subiendo}
                  onChange={async (e) => {
                    const archivo = e.target.files?.[0];
                    e.target.value = '';
                    if (!archivo) return;
                    if (archivo.type.startsWith('video/')) {
                      toast.error('Los videos no se suben: pega el enlace donde está publicado (YouTube, Drive u otro).');
                      return;
                    }
                    setSubiendo(true);
                    try {
                      const subido = await uploadService.upload(archivo);
                      setForm((x) => ({ ...x, fileId: subido.id, fileName: archivo.name }));
                    } catch (err) {
                      toast.error(apiError(err), 'Para un video o un archivo grande, usa un enlace.');
                    } finally {
                      setSubiendo(false);
                    }
                  }}
                />
              )}
              <span className="field-hint">PDF, PNG, JPG o WEBP, hasta 10 MB. Un video va por enlace.</span>
            </div>
          </fieldset>

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

          {/* V3.2 §35: áreas y habilidades del recurso, como en las actividades. */}
          <AreaSkillPicker
            areas={areas}
            skills={skills}
            value={{ areaIds: form.areaIds, skillIds: form.skillIds }}
            onChange={(v) => setForm({ ...form, areaIds: v.areaIds, academicAreaId: v.areaIds[0] ?? '', skillIds: v.skillIds })}
            areaLabel="Áreas"
            skillLabel="Habilidades que trabaja (opcional)"
            maxAreas={6}
          />

          <div className="field">
            <label htmlFor="learning-resources-imagen">Imagen (opcional)</label>
            {form.imageUrl && <ImagenProtegida src={form.imageUrl} className="activity-image-preview" />}
            <input
              id="learning-resources-imagen"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const subido = await uploadService.upload(f);
                  setForm((x) => ({ ...x, imageFileId: subido.id, imageUrl: URL.createObjectURL(f) }));
                } catch (err) {
                  toast.error(apiError(err));
                }
              }}
            />
          </div>

          <div className="flex" style={{ gap: '0.6rem' }}>
            <Button type="submit" loading={saving} icon={editing ? <FiSave size={15} /> : <FiPlus size={15} />}>
              {editing ? 'Guardar cambios' : esDocente && !directo ? 'Enviar propuesta' : esDocente ? 'Publicar' : 'Incorporar al catálogo'}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="secondary"
                icon={<FiX size={15} />}
                onClick={() => { setEditing(null); setForm(vacio); setAlcance('carrera'); setSemestres([]); }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card
        title={esDocente ? 'Mis propuestas y el catálogo' : 'Recursos del catálogo'}
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
              <>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <ThOrden clave="recurso" orden={orden} alternar={alternar}>Recurso</ThOrden>
                      <ThOrden clave="area" orden={orden} alternar={alternar}>Área</ThOrden>
                      <ThOrden clave="tipo" orden={orden} alternar={alternar}>Tipo</ThOrden>
                      <ThOrden clave="estado" orden={orden} alternar={alternar}>Estado</ThOrden>
                      <th><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pag.visibles.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="flex" style={{ gap: '0.4rem' }}>
                            <FiBookOpen size={13} /> {r.title}
                          </div>
                          {r.url ? (
                            <a
                              className="muted"
                              href={r.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              style={{ fontSize: '0.78rem' }}
                            >
                              {r.provider} <FiExternalLink size={11} />
                            </a>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.78rem' }}>{r.provider}</span>
                          )}
                          {r.fileUrl && (
                            <div>
                              <BotonArchivo src={r.fileUrl} nombre={r.fileName ?? 'material'} className="link-button small">
                                <FiFileText size={11} /> {r.fileName ?? 'Archivo'}
                              </BotonArchivo>
                            </div>
                          )}
                          <div className="muted small">
                            {r.semesterScope?.length ? `Para ${r.semesterScope.map((n) => `${n}.º`).join(', ')}` : 'Toda la carrera'}
                          </div>
                        </td>
                        <td className="muted">{r.academicArea?.name ?? '—'}</td>
                        <td className="muted">{TIPO_LABEL[r.resourceType] ?? r.resourceType}</td>
                        <td>
                          <Badge tone={r.status === 'active' ? 'green' : 'gray'}>
                            {r.status === 'active' ? 'Vigente' : 'Retirado'}
                          </Badge>
                          {r.reviewStatus && r.reviewStatus !== 'not_required' && (
                            <div><Badge tone={REVISION_TONO[r.reviewStatus]}>{REVISION_LABEL[r.reviewStatus]}</Badge></div>
                          )}
                          {r.reviewComment && r.reviewStatus !== 'approved' && <div className="muted small">«{r.reviewComment}»</div>}
                        </td>
                        <td>
                          <div className="flex" style={{ gap: '0.4rem' }}>
                            {/* V4.1 A41-014: el docente edita solo su propuesta pendiente u observada; retirar es de Dirección. */}
                            {(!esDocente || (r.createdBy === user?.id && (r.reviewStatus === 'pending' || r.reviewStatus === 'observed' || (!!r.policyId && r.reviewStatus === 'not_required')))) && (
                              <Button size="sm" variant="secondary" onClick={() => editar(r)}>
                                Editar
                              </Button>
                            )}
                            {!esDocente && (
                            <Button
                              size="sm"
                              variant={r.status === 'active' ? 'danger' : 'secondary'}
                              onClick={() => cambiarEstado(r)}
                            >
                              {r.status === 'active' ? 'Retirar' : 'Reponer'}
                            </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion {...pag} noun="recursos" />
              </>
            )
          }
        </AsyncView>
      </Card>
    </div>
  );
}
