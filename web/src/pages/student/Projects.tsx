import { useEffect, useMemo, useState } from 'react';
import {
  FiChevronDown,
  FiChevronRight,
  FiFolder,
  FiGithub,
  FiLink,
  FiMessageSquare,
  FiPaperclip,
  FiPlus,
  FiUsers,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  catalogService,
  evidenceService,
  projectFeedbackService,
  projectService,
} from '../../services';
import type {
  AcademicArea,
  Project,
  ProjectFeedbackItem,
} from '../../services/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
  Stagger,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { PROJECT_STATUS_LABEL, lbl } from '../../constants';

const emptyForm = { title: '', description: '', areaId: '', technologies: '', repositoryUrl: '' };

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function StudentProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [evForm, setEvForm] = useState<Record<string, { externalUrl: string; description: string }>>({});
  const toast = useToast();

  // Retroalimentacion docente (RF16). Se pide solo del proyecto que el
  // estudiante abre: el listado ya trae cuantos comentarios tiene cada uno.
  const [openFeedback, setOpenFeedback] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, ProjectFeedbackItem[]>>({});
  const [loadingFeedback, setLoadingFeedback] = useState<string | null>(null);

  const load = () => projectService.mine().then(setProjects);

  useEffect(() => {
    Promise.all([projectService.mine(), catalogService.areas()])
      .then(([p, a]) => {
        setProjects(p);
        setAreas(a);
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return projects;
    return projects.filter((p) =>
      [p.title, p.description ?? '', p.academicArea?.name ?? '', (p.technologies ?? []).join(' ')]
        .some((field) => normalize(field).includes(q)),
    );
  }, [projects, query]);

  const toggleFeedback = async (projectId: string) => {
    if (openFeedback === projectId) {
      setOpenFeedback(null);
      return;
    }
    setOpenFeedback(projectId);
    if (feedback[projectId]) return;
    setLoadingFeedback(projectId);
    try {
      const rows = await projectFeedbackService.list(projectId);
      setFeedback((prev) => ({ ...prev, [projectId]: rows }));
    } catch (err) {
      toast.error(apiError(err, 'No se pudo cargar la retroalimentación.'));
      setOpenFeedback(null);
    } finally {
      setLoadingFeedback(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await projectService.create({
        title: form.title,
        description: form.description || undefined,
        areaId: form.areaId || undefined,
        technologies: form.technologies
          ? form.technologies.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
        repositoryUrl: form.repositoryUrl || undefined,
        status: 'active',
      });
      setForm(emptyForm);
      await load();
      toast.success('Proyecto registrado', 'Ya forma parte de tu portafolio y de tu afinidad.');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  };

  const addEvidence = async (projectId: string) => {
    const data = evForm[projectId];
    if (!data?.externalUrl) {
      toast.info('Escribe el enlace de la evidencia antes de agregarla.');
      return;
    }
    setAddingTo(projectId);
    try {
      await evidenceService.add(projectId, {
        evidenceType: 'link',
        externalUrl: data.externalUrl,
        description: data.description || undefined,
      });
      setEvForm({ ...evForm, [projectId]: { externalUrl: '', description: '' } });
      await load();
      toast.success('Evidencia agregada al proyecto.');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setAddingTo(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Proyectos y evidencias"
        description="Registra tus proyectos académicos y respáldalos con enlaces. Cuentan para tu perfil y tu afinidad."
      />

      <Card title="Registrar proyecto">
        <form onSubmit={create}>
          <div className="row">
            <div className="field">
              <label>Título</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Sistema de monitoreo de sensores"
                required
              />
            </div>
            <div className="field">
              <label>Área académica</label>
              <select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Propósito del proyecto y qué resuelve…"
            />
          </div>
          <div className="row">
            <div className="field">
              <label>Tecnologías</label>
              <input
                value={form.technologies}
                onChange={(e) => setForm({ ...form, technologies: e.target.value })}
                placeholder="React, Node.js, PostgreSQL"
              />
              <span className="field-hint">Sepáralas con comas.</span>
            </div>
            <div className="field">
              <label>Repositorio</label>
              <input
                value={form.repositoryUrl}
                onChange={(e) => setForm({ ...form, repositoryUrl: e.target.value })}
                placeholder="https://github.com/…"
              />
            </div>
          </div>
          <Button type="submit" loading={creating} icon={<FiPlus size={15} />}>
            Crear proyecto
          </Button>
        </form>
      </Card>

      <div className="section-title">
        <h2>Mis proyectos</h2>
        <div className="flex" style={{ gap: '0.6rem' }}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar por título, área o tecnología…"
          />
          <ResultCount shown={visible.length} total={projects.length} noun="proyectos" />
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FiFolder size={22} />}
          message="Aún no has registrado proyectos. El primero que registres ya suma a tu afinidad."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FiFolder size={22} />}
          message={`Ningún proyecto coincide con “${query}”.`}
          action={
            <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
              Limpiar búsqueda
            </Button>
          }
        />
      ) : (
        visible.map((p, index) => (
          <Stagger key={p.id} index={index}>
            <Card
              title={p.title}
              actions={<Badge tone="bordo">{lbl(PROJECT_STATUS_LABEL, p.status)}</Badge>}
            >
              {p.description && <p>{p.description}</p>}

              <div className="activity-meta">
                <span><FiFolder size={13} /> {p.academicArea?.name ?? 'Sin área'}</span>
                <span><FiUsers size={13} /> {p.members?.length ?? 0} integrante{(p.members?.length ?? 0) === 1 ? '' : 's'}</span>
                {(p.feedbackCount ?? 0) > 0 && (
                  <span><FiMessageSquare size={13} /> {p.feedbackCount} comentario{p.feedbackCount === 1 ? '' : 's'}</span>
                )}
                {p.repositoryUrl && (
                  <a href={p.repositoryUrl} target="_blank" rel="noreferrer">
                    <FiGithub size={13} /> Repositorio
                  </a>
                )}
              </div>

              {p.technologies && p.technologies.length > 0 && (
                <div className="tag-list mt">
                  {p.technologies.map((t) => (
                    <span key={t} className="badge badge-gray">{t}</span>
                  ))}
                </div>
              )}

              {/* Retroalimentación docente (RF16). El estudiante vinculado al
                  proyecto puede leerla; el backend ya lo permitía, pero el
                  panel web no la pedía en ninguna pantalla. */}
              <div className="mt feedback-block">
                <button
                  type="button"
                  className="feedback-toggle"
                  onClick={() => toggleFeedback(p.id)}
                  aria-expanded={openFeedback === p.id}
                >
                  {openFeedback === p.id ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  <FiMessageSquare size={14} />
                  <span>
                    Retroalimentación docente
                    {(p.feedbackCount ?? 0) > 0 ? ` (${p.feedbackCount})` : ''}
                  </span>
                  {(p.feedbackCount ?? 0) > 0 && <Badge tone="green">Nueva</Badge>}
                </button>

                {openFeedback === p.id && (
                  <div className="feedback-list">
                    {loadingFeedback === p.id ? (
                      <Loading label="Cargando retroalimentación…" />
                    ) : (feedback[p.id] ?? []).length === 0 ? (
                      <p className="muted">
                        Todavía no recibes retroalimentación en este proyecto. Para que un
                        docente pueda comentarlo debe estar marcado como visible para docentes.
                      </p>
                    ) : (
                      (feedback[p.id] ?? []).map((f) => (
                        <article key={f.id} className="feedback-item">
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
                            {f.editedAt && <span>editada</span>}
                          </div>
                        </article>
                      ))
                    )}
                    <p className="muted" style={{ fontSize: '0.76rem', marginTop: '0.5rem' }}>
                      Orientación académica complementaria. No es una nota ni una evaluación
                      oficial.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt">
                <strong className="flex" style={{ gap: '0.4rem' }}>
                  <FiPaperclip size={14} /> Evidencias ({p.evidences?.length ?? 0})
                </strong>

                {(p.evidences ?? []).length > 0 && (
                  <ul className="plain-list">
                    {(p.evidences ?? []).map((ev) => (
                      <li key={ev.id} className="flex between">
                        <span>{ev.description || ev.evidenceType}</span>
                        <a href={ev.externalUrl ?? ev.fileUrl ?? '#'} target="_blank" rel="noreferrer">
                          <FiLink size={13} /> Abrir
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="row mt">
                  <input
                    placeholder="Enlace de evidencia (https://…)"
                    value={evForm[p.id]?.externalUrl ?? ''}
                    onChange={(e) =>
                      setEvForm({
                        ...evForm,
                        [p.id]: { ...(evForm[p.id] ?? { description: '' }), externalUrl: e.target.value },
                      })
                    }
                  />
                  <input
                    placeholder="Descripción"
                    value={evForm[p.id]?.description ?? ''}
                    onChange={(e) =>
                      setEvForm({
                        ...evForm,
                        [p.id]: { ...(evForm[p.id] ?? { externalUrl: '' }), description: e.target.value },
                      })
                    }
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    loading={addingTo === p.id}
                    onClick={() => addEvidence(p.id)}
                    icon={<FiPlus size={14} />}
                  >
                    Agregar enlace
                  </Button>
                </div>
              </div>
            </Card>
          </Stagger>
        ))
      )}
    </div>
  );
}
