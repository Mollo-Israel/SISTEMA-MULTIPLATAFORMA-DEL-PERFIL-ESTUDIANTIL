import { useEffect, useMemo, useState } from 'react';
import { enMemoria, useCachedState } from '../../hooks/viewCache';
import {
  FiChevronDown,
  FiChevronRight,
  FiFolder,
  FiGithub,
  FiLink,
  FiMessageSquare,
  FiPaperclip,
  FiClock,
  FiPlus,
  FiShield,
  FiUsers,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import {
  catalogService,
  collaborationService,
  evidenceService,
  projectDetailService,
  projectFeedbackService,
  projectService,
  uploadService,
  type TeamView,
} from '../../services';
import AreaSkillPicker from '../../components/AreaSkillPicker';
import ProjectReadiness from '../../components/ProjectReadiness';
import ProjectTechnicalCheck from '../../components/ProjectTechnicalCheck';
import { useAuth } from '../../auth/AuthContext';
import ProjectContribution from '../../components/ProjectContribution';
import AiAssist from '../../components/AiAssist';
import {
  PROJECT_BACKING_HELP,
  PROJECT_BACKING_LABEL,
  PROJECT_EVENT_LABEL,
  PROJECT_VISIBILITY_LABEL,
} from '../../services/types';
import type {
  AcademicArea,
  Project,
  ProjectEventItem,
  ProjectFeedbackItem,
  ProjectVisibility,
  Skill,
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
  Diferido,
  Stagger,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { PROJECT_STATUS_LABEL, lbl } from '../../constants';

const emptyForm = {
  title: '',
  description: '',
  areaIds: [] as string[],
  skillIds: [] as string[],
  repositoryUrl: '',
  demoUrl: '',
  visibility: 'profile' as ProjectVisibility,
  teamId: '',
  inviteTeamMembers: true,
};
const VISIBILIDADES = Object.keys(PROJECT_VISIBILITY_LABEL) as ProjectVisibility[];

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function StudentProjectsPage() {
  // Con memoria de la sesión: al volver a «Proyectos» se pinta al instante.
  const [projects, setProjects] = useCachedState<Project[]>('proyectos', []);
  const [areas, setAreas] = useCachedState<AcademicArea[]>('areas', []);
  const [skills, setSkills] = useCachedState<Skill[]>('skills', []);
  const [teams, setTeams] = useState<TeamView[]>([]);
  const [loading, setLoading] = useState(() => !enMemoria('proyectos'));
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [evForm, setEvForm] = useState<Record<string, { externalUrl: string; description: string }>>({});
  const toast = useToast();

  // Retroalimentacion docente (RF16). Se pide solo del proyecto que el
  // estudiante abre: el listado ya trae cuantos comentarios tiene cada uno.
  const [openFeedback, setOpenFeedback] = useState<string | null>(null);
  const [openContribution, setOpenContribution] = useState<string | null>(null);
  const [openTimeline, setOpenTimeline] = useState<string | null>(null);
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Record<string, ProjectEventItem[]>>({});
  const { user } = useAuth();

  /** La bitácora se pide al abrirla: es historia, no algo que mirar siempre. */
  const toggleTimeline = async (projectId: string) => {
    if (openTimeline === projectId) {
      setOpenTimeline(null);
      return;
    }
    setOpenTimeline(projectId);
    if (timeline[projectId]) return;
    try {
      const eventos = await projectDetailService.timeline(projectId);
      setTimeline((prev) => ({ ...prev, [projectId]: eventos }));
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const [feedback, setFeedback] = useState<Record<string, ProjectFeedbackItem[]>>({});
  const [loadingFeedback, setLoadingFeedback] = useState<string | null>(null);

  const load = () => projectService.mine().then(setProjects);

  useEffect(() => {
    Promise.all([projectService.mine(), catalogService.areas(), catalogService.skills()])
      .then(([p, a, sk]) => {
        setProjects(p);
        setAreas(a);
        setSkills(sk.filter((x) => x.isActive !== false));
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    collaborationService.myTeams().then(setTeams).catch(() => setTeams([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return projects;
    return projects.filter((p) =>
      [p.title, p.description ?? '', (p.projectAreas ?? []).map((a) => a.academicArea?.name ?? '').join(' '),
        p.academicArea?.name ?? '', (p.technologies ?? []).join(' ')]
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

  // V3 §21: se guarda como borrador aunque esté incompleto; se activa cuando
  // cumple los requisitos (§22), desde la tarjeta del proyecto.
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await projectService.create({
        title: form.title,
        description: form.description || undefined,
        areaIds: form.areaIds,
        skillIds: form.skillIds,
        repositoryUrl: form.repositoryUrl || undefined,
        demoUrl: form.demoUrl || undefined,
        visibility: form.visibility,
        teamId: form.teamId || undefined,
        inviteTeamMembers: form.teamId ? form.inviteTeamMembers : undefined,
        status: 'draft',
      });
      setForm(emptyForm);
      await load();
      toast.success('Borrador guardado', 'Completa lo que falta en su tarjeta y actívalo.');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setCreating(false);
    }
  };

  const cambiarVisibilidad = async (p: Project, visibility: ProjectVisibility) => {
    try {
      await projectService.update(p.id, { visibility });
      await load();
      toast.success('Visibilidad actualizada', PROJECT_VISIBILITY_LABEL[visibility]);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const enlacePublico = (token: string) => `${window.location.origin}/proyecto/${token}`;

  const subirCaptura = async (projectId: string, file: File) => {
    setAddingTo(projectId);
    try {
      const subido = await uploadService.upload(file);
      await evidenceService.add(projectId, {
        evidenceType: 'file',
        storedFileId: subido.id,
        description: 'Captura del funcionamiento',
      });
      await load();
      toast.success('Captura agregada al proyecto.');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setAddingTo(null);
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
        title="Proyectos"
        description="Guarda tus proyectos como borrador y actívalos cuando cumplan lo mínimo: áreas, tecnologías, repositorio público, integrantes confirmados y una evidencia de funcionamiento. Las evidencias viven dentro de cada proyecto."
      />

      <Card title="Nuevo proyecto">
        <form onSubmit={create}>
          <div className="row">
            <div className="field">
              <label htmlFor="pr-titulo">Título</label>
              <input
                id="pr-titulo"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Sistema de monitoreo de sensores"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pr-visibilidad">Quién lo ve</label>
              <select
                id="pr-visibilidad"
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as ProjectVisibility })}
              >
                {VISIBILIDADES.map((v) => <option key={v} value={v}>{PROJECT_VISIBILITY_LABEL[v]}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="pr-descripcion">Descripción</label>
            <textarea
              id="pr-descripcion"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Propósito del proyecto y qué resuelve…"
            />
          </div>
          <AreaSkillPicker
            areas={areas}
            skills={skills}
            value={{ areaIds: form.areaIds, skillIds: form.skillIds }}
            onChange={(v) => setForm({ ...form, areaIds: v.areaIds, skillIds: v.skillIds })}
            areaLabel="Áreas del proyecto"
            skillLabel="Tecnologías que usa"
            maxAreas={6}
            maxSkills={20}
          />
          <div className="row">
            <div className="field">
              <label htmlFor="pr-repo">Repositorio público</label>
              <input
                id="pr-repo"
                value={form.repositoryUrl}
                onChange={(e) => setForm({ ...form, repositoryUrl: e.target.value })}
                placeholder="https://github.com/usuario/proyecto"
              />
              <span className="field-hint">Obligatorio para activarlo; se comprueba que exista y sea público.</span>
            </div>
            <div className="field">
              <label htmlFor="pr-demo">Demo (opcional)</label>
              <input
                id="pr-demo"
                value={form.demoUrl}
                onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
                placeholder="https://mi-proyecto.example.com"
              />
            </div>
          </div>
          {teams.length > 0 && (
            <div className="field">
              <label htmlFor="pr-equipo">Equipo de colaboración (opcional)</label>
              <select id="pr-equipo" value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                <option value="">Sin equipo</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {form.teamId && (
                <label className="check-line" style={{ marginTop: '0.4rem' }}>
                  <input
                    type="checkbox"
                    checked={form.inviteTeamMembers}
                    onChange={(e) => setForm({ ...form, inviteTeamMembers: e.target.checked })}
                  />
                  Invitar a los integrantes del equipo (cada uno acepta y confirma su contribución)
                </label>
              )}
            </div>
          )}
          <Button type="submit" loading={creating} icon={<FiPlus size={15} />}>
            Guardar borrador
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
        <Diferido><SkeletonCards count={3} /></Diferido>
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
                <span>
                  <FiFolder size={13} />{' '}
                  {(p.projectAreas ?? []).length
                    ? (p.projectAreas ?? []).map((a) => a.academicArea?.name).filter(Boolean).join(' · ')
                    : p.academicArea?.name ?? 'Sin área'}
                </span>
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

              {(p.projectSkills ?? []).length > 0 ? (
                <div className="tag-list mt">
                  {(p.projectSkills ?? []).map((sk) => (
                    <span key={sk.skillId} className="badge badge-gray">{sk.skill?.name}</span>
                  ))}
                </div>
              ) : p.technologies && p.technologies.length > 0 && (
                <div className="tag-list mt">
                  {p.technologies.map((t) => (
                    <span key={t} className="badge badge-gray">{t}</span>
                  ))}
                </div>
              )}

              {p.status === 'draft' && (
                <ProjectReadiness projectId={p.id} canActivate={p.isOwner === true} onActivated={load} />
              )}

              {p.isOwner && (
                <div className="field mt" style={{ maxWidth: 420 }}>
                  <label htmlFor={`vis-${p.id}`}>Quién lo ve</label>
                  <select
                    id={`vis-${p.id}`}
                    value={p.visibility ?? 'profile'}
                    onChange={(e) => cambiarVisibilidad(p, e.target.value as ProjectVisibility)}
                  >
                    {VISIBILIDADES.map((v) => <option key={v} value={v}>{PROJECT_VISIBILITY_LABEL[v]}</option>)}
                  </select>
                  {p.visibility === 'public_link' && p.publicLinkToken && (
                    <span className="field-hint">
                      Enlace:{' '}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          navigator.clipboard?.writeText(enlacePublico(p.publicLinkToken!));
                          toast.success('Enlace copiado.');
                        }}
                      >
                        copiar enlace público
                      </button>
                      {p.status === 'draft' && ' (se verá cuando el proyecto esté activo)'}
                    </span>
                  )}
                </div>
              )}

              {/*
                §36: el nivel de respaldo se deriva de señales observables y se
                explica. No mide calidad: un proyecto excelente de una sola
                persona sin repositorio público se queda en «Declarado», y eso
                no dice nada malo de él.
              */}
              {p.backingTier && (
                <div className="mt respaldo-proyecto">
                  <Badge
                    tone={
                      p.backingTier === 'flagged' ? 'red'
                        : p.backingTier === 'reviewed' || p.backingTier === 'corroborated' ? 'green'
                          : p.backingTier === 'supported' ? 'bordo' : 'gray'
                    }
                  >
                    <FiShield size={11} /> {PROJECT_BACKING_LABEL[p.backingTier]}
                  </Badge>
                  <span className="muted">{PROJECT_BACKING_HELP[p.backingTier]}</span>
                  {(p.backingReasons ?? []).length > 0 && (
                    <ul className="respaldo-motivos">
                      {(p.backingReasons ?? []).map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  )}
                  {p.backingTier === 'flagged' && (
                    <AiAssist
                      task="INCONSISTENCY_EXPLANATION"
                      label="Explicar en palabras simples"
                      request={() => ({ projectId: p.id })}
                      render={(r) => <p style={{ margin: 0 }}>{r.explanation}</p>}
                    />
                  )}
                </div>
              )}

              {/*
                §33: el integrante confirma lo que hizo. Sin esta pantalla,
                quien acepta una invitación no obtiene nada del proyecto.
              */}
              <div className="mt feedback-block">
                <button
                  type="button"
                  className="feedback-toggle"
                  onClick={() => setOpenContribution(openContribution === p.id ? null : p.id)}
                  aria-expanded={openContribution === p.id}
                >
                  {openContribution === p.id ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  <FiUsers size={14} />
                  <span>Contribuciones del equipo</span>
                </button>
                {openContribution === p.id && user && (
                  <div className="feedback-list">
                    <ProjectContribution
                      projectId={p.id}
                      currentUserId={user.id}
                      isOwner={p.isOwner === true}
                      onChanged={load}
                    />
                  </div>
                )}
              </div>

              {/* V3 §25: de dónde sale cada señal técnica. */}
              <div className="mt feedback-block">
                <button
                  type="button"
                  className="feedback-toggle"
                  onClick={() => setOpenCheck(openCheck === p.id ? null : p.id)}
                  aria-expanded={openCheck === p.id}
                >
                  {openCheck === p.id ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  <FiGithub size={14} />
                  <span>Validación técnica</span>
                </button>
                {openCheck === p.id && (
                  <div className="feedback-list">
                    <ProjectTechnicalCheck projectId={p.id} canRecheck={p.isOwner === true} />
                  </div>
                )}
              </div>

              {/* §41: la bitácora del proyecto, en eventos, no en conversaciones. */}
              <div className="mt feedback-block">
                <button
                  type="button"
                  className="feedback-toggle"
                  onClick={() => toggleTimeline(p.id)}
                  aria-expanded={openTimeline === p.id}
                >
                  {openTimeline === p.id ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  <FiClock size={14} />
                  <span>Bitácora del proyecto</span>
                </button>
                {openTimeline === p.id && (
                  <div className="feedback-list">
                    {(timeline[p.id] ?? []).length === 0 ? (
                      <p className="muted">Sin eventos registrados todavía.</p>
                    ) : (
                      <ul className="bitacora">
                        {(timeline[p.id] ?? []).map((e) => (
                          <li key={e.id}>
                            <span className="ev">{PROJECT_EVENT_LABEL[e.eventType] ?? e.eventType}</span>
                            <span className="muted">
                              {e.actor ?? 'Sistema'} ·{' '}
                              {new Date(e.createdAt).toLocaleString('es-BO')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

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
                  <AiAssist
                    task="EVIDENCE_SUMMARY"
                    label="Resumir evidencias"
                    request={() => ({ projectId: p.id })}
                    render={(r) => <p style={{ margin: 0 }}>{r.summary}</p>}
                  />
                )}

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
                <div className="field mt">
                  <label htmlFor={`cap-${p.id}`}>O sube una captura del funcionamiento (PNG, JPG o PDF)</label>
                  <input
                    id={`cap-${p.id}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    disabled={addingTo === p.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) subirCaptura(p.id, f);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </Card>
          </Stagger>
        ))
      )}
    </div>
  );
}
