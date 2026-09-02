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
import { AsyncView, Card, Badge, Loading, EmptyState } from '../../components/ui';
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
  const [msg, setMsg] = useState<string | null>(null);

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

  const notify = (t: string) => {
    setMsg(t);
    setError(null);
    window.setTimeout(() => setMsg(null), 4000);
  };

  const openProject = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setError(null);
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
      setError(apiError(e, 'No se pudo cargar el proyecto.'));
      setMembers([]);
      setFeedback([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await projectFeedbackService.update(selectedId, editingId, comment);
        notify('Retroalimentación actualizada.');
      } else {
        await projectFeedbackService.create(selectedId, comment);
        notify('Retroalimentación registrada. El estudiante ya puede verla.');
      }
      setComment('');
      setEditingId(null);
      setFeedback(await projectFeedbackService.list(selectedId));
    } catch (e2) {
      setError(apiError(e2));
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
      <h1>Proyectos estudiantiles</h1>
      <p className="muted">
        Consulte los proyectos que sus estudiantes habilitaron para revisión docente y registre
        retroalimentación académica. La retroalimentación es orientación complementaria: no es una
        nota ni una evaluación oficial.
      </p>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

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
              <input
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Buscar…"
              />
            </div>
            <button className="btn btn-secondary btn-sm" type="submit">
              <FiSearch /> Buscar
            </button>
            {hasFilters && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const empty = { status: '', areaId: '', technology: '', semester: '', search: '' };
                  setFilters(empty);
                  setApplied(empty);
                }}
              >
                Limpiar
              </button>
            )}
          </form>

          <AsyncView
            loading={loading}
            error={error}
            data={data}
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
                      <tr key={p.id}>
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
                          <button
                            className={`btn btn-sm ${selectedId === p.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => openProject(p.id)}
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AsyncView>
          {projects.length > 0 && (
            <p className="muted" style={{ marginTop: '0.6rem', fontSize: '0.8rem' }}>
              {projects.length} proyecto{projects.length === 1 ? '' : 's'} visible
              {projects.length === 1 ? '' : 's'}
            </p>
          )}
        </Card>
      )}

      {detailLoading && <Loading label="Cargando proyecto…" />}

      {selected && !detailLoading && (
        <>
          <Card title={selected.title}>
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
                <button className="btn btn-primary" disabled={saving || comment.trim().length < 10}>
                  <FiMessageSquare />{' '}
                  {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Registrar retroalimentación'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingId(null);
                      setComment('');
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="mt">
              {feedback.length === 0 ? (
                <EmptyState message="Todavía no hay retroalimentación registrada para este proyecto." />
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
        </>
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
