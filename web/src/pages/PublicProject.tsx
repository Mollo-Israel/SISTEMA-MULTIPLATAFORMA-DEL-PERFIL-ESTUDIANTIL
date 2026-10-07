import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiAlertCircle, FiExternalLink, FiFolder, FiGithub } from 'react-icons/fi';
import { projectService } from '../services';
import type { PublicProjectView } from '../services/types';
import { PROJECT_BACKING_LABEL } from '../services/types';
import { Badge, Card, Loading } from '../components/ui';

/**
 * Resumen público de un proyecto compartido por enlace (V3 §40).
 *
 * Solo lo que describe el proyecto. Integrantes, archivos, bitácora,
 * auditoría y retroalimentación docente no se publican aunque el proyecto
 * se comparta.
 */
export default function PublicProjectPage() {
  const { token = '' } = useParams();
  const [p, setP] = useState<PublicProjectView | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'no-existe'>('cargando');

  useEffect(() => {
    projectService.publicView(token)
      .then((v) => { setP(v); setEstado('listo'); })
      .catch(() => setEstado('no-existe'));
  }, [token]);

  if (estado === 'cargando') return <div className="public-page"><Loading /></div>;
  if (estado === 'no-existe' || !p) {
    return (
      <div className="public-page">
        <Card>
          <div className="state">
            <FiAlertCircle size={26} />
            <p className="muted">Este enlace no lleva a ningún proyecto compartido. Puede que su dueño lo haya cerrado.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="public-page">
      <Card>
        <div className="flex" style={{ gap: '0.8rem', alignItems: 'center' }}>
          <FiFolder size={26} />
          <div>
            <h1 style={{ margin: 0 }}>{p.title}</h1>
            <span className="muted">{p.areas.join(' · ')}</span>
          </div>
        </div>
        {p.description && <p className="mt">{p.description}</p>}
        {p.skills.length > 0 && (
          <div className="tag-list mt">
            {p.skills.map((s) => <span key={s} className="badge badge-gray">{s}</span>)}
          </div>
        )}
        <div className="flex mt" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
          {p.repositoryUrl && (
            <a className="btn btn-secondary btn-sm" href={p.repositoryUrl} target="_blank" rel="noreferrer noopener">
              <FiGithub /> Repositorio
            </a>
          )}
          {p.demoUrl && (
            <a className="btn btn-secondary btn-sm" href={p.demoUrl} target="_blank" rel="noreferrer noopener">
              <FiExternalLink /> Demo
            </a>
          )}
          <Badge tone="gray">{PROJECT_BACKING_LABEL[p.backingTier as keyof typeof PROJECT_BACKING_LABEL] ?? p.backingTier}</Badge>
        </div>
        <p className="muted small mt">
          Resumen compartido desde Afinia. El nivel de respaldo indica qué pudo comprobarse en fuentes
          públicas; no es una calificación.
        </p>
      </Card>
    </div>
  );
}
