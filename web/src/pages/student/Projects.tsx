import { useEffect, useState } from 'react';
import { apiError } from '../../api/client';
import { catalogService, evidenceService, projectService } from '../../services';
import type { AcademicArea, Project } from '../../services/types';
import { Card, Loading, EmptyState, Badge } from '../../components/ui';

export default function StudentProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', areaId: '', technologies: '', repositoryUrl: '' });
  const [evForm, setEvForm] = useState<Record<string, { externalUrl: string; description: string }>>({});

  const load = () => projectService.mine().then(setProjects);

  useEffect(() => {
    Promise.all([projectService.mine(), catalogService.areas()])
      .then(([p, a]) => { setProjects(p); setAreas(a); })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await projectService.create({
        title: form.title,
        description: form.description || undefined,
        areaId: form.areaId || undefined,
        technologies: form.technologies ? form.technologies.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        repositoryUrl: form.repositoryUrl || undefined,
        status: 'active',
      });
      setForm({ title: '', description: '', areaId: '', technologies: '', repositoryUrl: '' });
      await load();
    } catch (err) { setError(apiError(err)); }
  };

  const addEvidence = async (projectId: string) => {
    const data = evForm[projectId];
    if (!data?.externalUrl) return;
    try {
      await evidenceService.add(projectId, { evidenceType: 'link', externalUrl: data.externalUrl, description: data.description || undefined });
      setEvForm({ ...evForm, [projectId]: { externalUrl: '', description: '' } });
      await load();
    } catch (err) { setError(apiError(err)); }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1>Proyectos y evidencias</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <Card title="Registrar proyecto">
        <form onSubmit={create}>
          <div className="row">
            <div className="field"><label>Título</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="field">
              <label>Área</label>
              <select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
                <option value="">Sin área</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Descripción</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="row">
            <div className="field"><label>Tecnologías (separadas por coma)</label><input value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} placeholder="React, Node.js" /></div>
            <div className="field"><label>Repositorio (URL)</label><input value={form.repositoryUrl} onChange={(e) => setForm({ ...form, repositoryUrl: e.target.value })} placeholder="https://..." /></div>
          </div>
          <button className="btn btn-primary">Crear proyecto</button>
        </form>
      </Card>

      <div className="section-title"><h2>Mis proyectos</h2></div>
      {projects.length === 0 ? (
        <EmptyState message="Aún no has registrado proyectos." />
      ) : (
        projects.map((p) => (
          <Card key={p.id} title={p.title} actions={<Badge tone="bordo">{p.status}</Badge>}>
            {p.description && <p>{p.description}</p>}
            <p className="muted">Área: {p.academicArea?.name ?? '—'} · Integrantes: {p.members?.length ?? 0}</p>
            {p.technologies && p.technologies.length > 0 && (
              <div className="tag-list">{p.technologies.map((t) => <span key={t} className="badge badge-gray">{t}</span>)}</div>
            )}
            <div className="mt">
              <strong>Evidencias ({p.evidences?.length ?? 0})</strong>
              <ul>
                {(p.evidences ?? []).map((ev) => (
                  <li key={ev.id}>{ev.description || ev.evidenceType}: <a href={ev.externalUrl ?? ev.fileUrl ?? '#'} target="_blank" rel="noreferrer">{ev.externalUrl ?? ev.fileUrl}</a></li>
                ))}
              </ul>
              <div className="row">
                <input placeholder="Enlace de evidencia (https://...)" value={evForm[p.id]?.externalUrl ?? ''} onChange={(e) => setEvForm({ ...evForm, [p.id]: { ...(evForm[p.id] ?? { description: '' }), externalUrl: e.target.value } })} />
                <input placeholder="Descripción" value={evForm[p.id]?.description ?? ''} onChange={(e) => setEvForm({ ...evForm, [p.id]: { ...(evForm[p.id] ?? { externalUrl: '' }), description: e.target.value } })} />
                <button className="btn btn-secondary" type="button" onClick={() => addEvidence(p.id)}>Agregar enlace</button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
