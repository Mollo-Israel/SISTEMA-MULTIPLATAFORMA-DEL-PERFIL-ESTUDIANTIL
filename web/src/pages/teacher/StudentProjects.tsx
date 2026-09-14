import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiFolder,
  FiInfo,
  FiExternalLink,
  FiMessageSquare,
  FiSearch,
  FiUsers,
  FiEdit2,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { catalogService, projectFeedbackService, projectService } from '../../services';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonCards, SkeletonTable, Stagger,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { PROJECT_STATUS_LABEL, PROJECT_STATUSES, lbl } from '../../constants';
import type {
  AcademicArea,
  InstitutionalPortfolio,
  ProjectFeedbackItem,
  ProjectMemberItem,
} from '../../services/types';

/**
 * Portafolio institucional de proyectos (RF15) y retroalimentación docente (RF16).
 *
 * Solo muestra proyectos que el estudiante habilitó para consulta docente y que
 * pertenecen a los semestres asignados al docente. El backend aplica la misma
 * regla: ocultar la pantalla no sería autorización.
 */
export default function TeacherStudentProjectsPage() {
  const [filters, setFilters] = useState({
    status: '',
    areaId: '',
    technology: '',
    semester: '',
    search: '',
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<InstitutionalPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<AcademicArea[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMemberItem[]>([]);
  const [feedback, setFeedback] = useState<ProjectFeedbackItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (applied.status) p.status = applied.status;
    if (applied.areaId) p.areaId = applied.areaId;
    if (applied.technology) p.technology = applied.technology;
    if (applied.semester) p.semester = applied.semester;
    if (applied.search) p.search = applied.search;
    return p;
  }, [applied]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    projectService
      .institutional(params)
      .then(setData)
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    catalogService.areas().then(setAreas).catch(() => {});
  }, []);

  const notify = (t: string, detail?: string) => toast.success(t, detail);

  const openProject = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setComment('');
    setEditingId(null);
    try {
      const [m, f] = await Promise.all([
        projectService.members(id).catch(() => []),
        projectFeedbackService.list(id),
      ]);
      setMembers(m);
      setFeedback(f);
    } catch (e) {
      toast.error(apiError(e, 'No se pudo cargar el proyecto.'));
      setMembers([]);
      setFeedback([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const ok = await confirm({
      title: editingId ? 'Guardar los cambios' : 'Publicar la retroalimentación',
      message: editingId
        ? 'El estudiante y sus integrantes verán el comentario corregido en su portafolio.'
        : 'El estudiante y sus integrantes verán este comentario en su portafolio. Es orientación académica, no una nota.',
      confirmLabel: editingId ? 'Guardar cambios' : 'Publicar',
    });
    if (!ok) return;
    setSaving(true);
    try {
      if (editingId) {
        await projectFeedbackService.update(selectedId, editingId, comment);
        notify('Retroalimentación actualizada.');
      } else {
        await projectFeedbackService.create(selectedId, comment);
        notify('Retroalimentación registrada.', 'El estudiante ya puede verla.');
      }
      setComment('');
      setEditingId(null);
      setFeedback(await projectFeedbackService.list(selectedId));
    } catch (e2) {
      toast.error(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  const projects = data?.projects ?? [];
  const scope = data?.scope;
  const noScope = scope?.restricted && scope.semesters.length === 0;
  const selected = projects.find((p) => p.id === selectedId);
  const hasFilters = Object.values(applied).some(Boolean);

  return (
    <div>
      <PageHeader
        title="Proyectos estudiantiles"
        description="Los proyectos que sus estudiantes habilitaron para revisión docente. La retroalimentación es orientación complementaria: no es una nota ni una evaluación oficial."
      />

      {scope?.restricted && !noScope && (
        <div className="scope-note">
          <FiInfo />
          <span>
            Solo se muestran proyectos de sus semestres habilitados:{' '}
            <strong>{scope.semesters.map((s) => `${s}º`).join(', ')}</strong>. Además, el estudiante
            debe haber marcado el proyecto como visible para docentes.
          </span>
        </div>
      )}

      {noScope ? (
        <Card>
          <div className="state">
            <FiFolder size={26} style={{ opacity: 0.4 }} />
            <p style={{ marginTop: '0.6rem' }}>
              <strong>Todavía no tiene semestres habilitados.</strong>
            </p>
            <p className="muted">
              Solicite al administrador que le asigne los semestres que debe acompañar.
            </p>
          </div>
        </Card>
      ) : (
        <Card title="Buscar proyectos">
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(filters);
            }}
          >
            <div className="field">
              <label>Estado</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">Todos</option>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {lbl(PROJECT_STATUS_LABEL, s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Área académica</label>
              <select
                value={filters.areaId}
                onChange={(e) => setFilters({ ...filters, areaId: e.target.value })}
              >
                <option value="">Todas</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Semestre</label>
              <select
                value={filters.semester}
                onChange={(e) => setFilters({ ...filters, semester: e.target.value })}
              >
                <option value="">Todos los habilitados</option>
                {(scope?.semesters ?? []).map((s) => (
                  <option key={s} value={String(s)}>
                    {s}º
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tecnología</label>
              <input
                value={filters.technology}
                onChange={(e) => setFilters({ ...filters, technology: e.target.value })}
                placeholder="React"
              />
            </div>
            <div className="field">
              <label>Estudiante o título</label>
              <SearchInput
                value={filters.search}
                onChange={(value) => setFilters({ ...filters, search: value })}
                placeholder="Nombre del estudiante o título…"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" icon={<FiSearch size={14} />}>
              Buscar
            </Button>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const empty = { status: '', areaId: '', technology: '', semester: '', search: '' };
                  setFilters(empty);
                  setApplied(empty);
                }}
              >
                Limpiar
              </Button>
            )}
          </form>

          <AsyncView
            loading={loading}
            error={error}
            data={data}
            skeleton={<SkeletonTable rows={5} columns={6} />}
            isEmpty={() => projects.length === 0}
            emptyMessage={
              hasFilters
                ? 'Ningún proyecto coincide con los filtros aplicados.'
                : 'Ningún estudiante de sus semestres habilitados ha marcado un proyecto como visible para docentes.'
            }
          >
            {() => (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Proyecto</th>
                      <th>Estudiante</th>
                      <th>Semestre</th>
                      <th>Área</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id} className={selectedId === p.id ? 'row-picked' : undefined}>
                        <td>
                          <strong>{p.title}</strong>
                          {p.technologies && p.technologies.length > 0 && (
                            <div className="muted">{p.technologies.join(' · ')}</div>
                          )}
                        </td>
                        <td>{p.student ?? '—'}</td>
                        <td className="muted">{p.semester ? `${p.semester}º` : '—'}</td>
                        <td className="muted">{p.area ?? '—'}</td>
                        <td>
                          <Badge tone={p.status === 'active' ? 'green' : 'gray'}>
                            {lbl(PROJECT_STATUS_LABEL, p.status)}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant={selectedId === p.id ? 'primary' : 'secondary'}
                            loading={detailLoading && selectedId === p.id}
                            onClick={() => openProject(p.id)}
                          >
                            Abrir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AsyncView>
          {projects.length > 0 && (
            <div style={{ marginTop: '0.6rem' }}>
              <ResultCount
                shown={projects.length}
                total={projects.length}
                noun="proyectos visibles"
              />
            </div>
          )}
        </Card>
      )}

      {detailLoading && <SkeletonCards count={2} />}

      {selected && !detailLoading && (
        <Stagger index={0}>
          <Card
            title={selected.title}
            actions={
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                Cerrar
              </Button>
            }
          >
            <p className="muted">
              {selected.student} · {selected.semester ? `${selected.semester}º semestre` : 'Sin semestre'}{' '}
              · {lbl(PROJECT_STATUS_LABEL, selected.status)}
            </p>
            {selected.description && <p style={{ marginTop: '0.6rem' }}>{selected.description}</p>}

            <div className="grid cols-2 mt">
              <div>
                <strong>Tecnologías</strong>
                {selected.technologies?.length ? (
                  <div className="tag-list mt">
                    {selected.technologies.map((t) => (
                      <Badge key={t} tone="gray">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Sin tecnologías declaradas.</p>
                )}
              </div>
              <div>
                <strong>Enlaces</strong>
                <div className="activity-meta" style={{ marginTop: '0.4rem' }}>
                  {selected.repositoryUrl && (
                    <a href={selected.repositoryUrl} target="_blank" rel="noreferrer">
                      <FiExternalLink /> Repositorio
                    </a>
                  )}
                  {selected.demoUrl && (
                    <a href={selected.demoUrl} target="_blank" rel="noreferrer">
                      <FiExternalLink /> Demostración
                    </a>
                  )}
                  {!selected.repositoryUrl && !selected.demoUrl && (
                    <span className="muted">Sin enlaces registrados.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt">
              <strong>
                <FiUsers /> Integrantes ({members.length})
              </strong>
              {members.length === 0 ? (
                <p className="muted">Proyecto individual: no tiene integrantes adicionales.</p>
              ) : (
                <ul className="plain-list">
                  {members.map((m) => (
                    <li key={m.id}>
                      {m.name} <span className="muted">· {m.role ?? 'sin rol declarado'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card title={`Retroalimentación (${feedback.length})`}>
            <p className="muted" style={{ marginBottom: '0.8rem' }}>
              Orientación académica complementaria. No constituye una nota ni una evaluación
              oficial. El estudiante y sus integrantes la verán en su portafolio.
            </p>

            <form onSubmit={submitFeedback}>
              <div className="field">
                <label>{editingId ? 'Editar su comentario' : 'Nuevo comentario'}</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  minLength={10}
                  maxLength={1000}
                  required
                  placeholder="Observaciones sobre el enfoque, la documentación, las tecnologías o los siguientes pasos."
                />
                <span className="muted" style={{ fontSize: '0.76rem' }}>
                  {comment.length}/1000 caracteres · mínimo 10
                </span>
              </div>
              <div className="flex" style={{ gap: '0.5rem' }}>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={comment.trim().length < 10}
                  icon={<FiMessageSquare size={15} />}
                >
                  {editingId ? 'Guardar cambios' : 'Registrar retroalimentación'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(null);
                      setComment('');
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>

            <div className="mt">
              {feedback.length === 0 ? (
                <EmptyState
                  icon={<FiMessageSquare size={22} />}
                  message="Todavía no hay retroalimentación registrada para este proyecto."
                />
              ) : (
                <div className="evidence-list">
                  {feedback.map((f) => (
                    <div key={f.id} className="evidence-item">
                      <div className="ev-icon constancy">
                        <FiMessageSquare />
                      </div>
                      <div className="grow">
                        <p>{f.comment}</p>
                        <div className="activity-meta">
                          <span>{f.teacher ?? 'Docente'}</span>
                          <span>
                            {new Date(f.createdAt).toLocaleDateString('es-BO', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                          {f.editedAt && <span>Editada</span>}
                        </div>
                      </div>
                      {f.canEdit && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingId(f.id);
                            setComment(f.comment);
                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                          }}
                        >
                          <FiEdit2 /> Editar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </Stagger>
      )}

      {!selected && !detailLoading && projects.length > 0 && (
        <div className="state">
          <FiFolder size={24} style={{ opacity: 0.4 }} />
          <p className="muted">Abra un proyecto para ver su detalle y registrar retroalimentación.</p>
        </div>
      )}
    </div>
  );
}
