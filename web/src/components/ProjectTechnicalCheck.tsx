import { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { apiError } from '../api/client';
import { projectDetailService } from '../services';
import type { ProjectChecks } from '../services/types';
import { Badge, Button, Loading } from './ui';
import { useToast } from './feedback';

const ESTADO_TEC: Record<string, { label: string; tone: 'green' | 'gray' | 'bordo' }> = {
  both: { label: 'Corroborada', tone: 'green' },
  declared: { label: 'Declarada', tone: 'gray' },
  detected: { label: 'Encontrada, no declarada', tone: 'bordo' },
};

const ESTADO_ENLACE: Record<string, string> = {
  available: 'accesible',
  unavailable: 'no disponible o no público',
  blocked: 'dirección no permitida',
  unverified: 'sin comprobar (se reintentará)',
};

/**
 * Validación técnica del proyecto (V3 §24, §25 paso 9, §26).
 *
 * Explica de dónde sale cada señal: el lenguaje que reporta GitHub, la
 * dependencia de un manifiesto o la imagen de docker-compose. Lo que no se
 * encontró queda «Declarada»: no es falso ni resta (§29).
 */
export default function ProjectTechnicalCheck({ projectId, canRecheck }: { projectId: string; canRecheck: boolean }) {
  const [c, setC] = useState<ProjectChecks | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    projectDetailService.checks(projectId).then(setC).catch(() => setC(null));
  }, [projectId]);

  const recheck = async () => {
    setBusy(true);
    try {
      setC(await projectDetailService.recheck(projectId));
      toast.success('Comprobación actualizada.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!c) return <Loading label="Cargando validación técnica…" />;
  const repo = c.repository;
  const meta = repo?.metadata as (NonNullable<typeof repo>['metadata'] & { pushedAt?: string | null; fromCache?: boolean }) | null | undefined;

  return (
    <div className="technical-check">
      {repo ? (
        <>
          <p style={{ margin: '0 0 0.4rem' }}>
            <strong>Repositorio:</strong> {ESTADO_ENLACE[repo.status] ?? repo.status}
            {meta?.languages?.length ? ` · lenguajes: ${meta.languages.slice(0, 5).join(', ')}` : ''}
            {meta?.pushedAt ? ` · último cambio: ${new Date(meta.pushedAt).toLocaleDateString('es-BO')}` : ''}
          </p>
          {repo.technologySignals.length > 0 && (
            <ul className="plain-list">
              {repo.technologySignals.map((t) => (
                <li key={`${t.name}-${t.status}`} className="flex between" style={{ gap: '0.5rem' }}>
                  <span>
                    {t.name}
                    {t.source && <span className="muted small"> · {t.source === 'languages' ? 'lenguajes del repositorio' : t.source}</span>}
                  </span>
                  <Badge tone={ESTADO_TEC[t.status]?.tone ?? 'gray'}>{ESTADO_TEC[t.status]?.label ?? t.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="muted">Sin repositorio que comprobar.</p>
      )}
      {c.demo && (
        <p style={{ margin: '0.4rem 0' }}>
          <strong>Demo:</strong> {ESTADO_ENLACE[c.demo.status] ?? c.demo.status}
          {c.demo.title ? ` · «${c.demo.title}»` : ''}
          {c.demo.isHttps ? ' · HTTPS' : ''}
        </p>
      )}
      <p className="muted small">{c.disclaimer}</p>
      {canRecheck && (
        <Button size="sm" variant="secondary" loading={busy} onClick={recheck} icon={<FiRefreshCw size={13} />}>
          Volver a comprobar
        </Button>
      )}
    </div>
  );
}
