import { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { apiError } from '../api/client';
import { projectDetailService } from '../services';
import type { ProjectChecks } from '../services/types';
import type { ProjectSuggestions } from '../services';
import { Badge, Button, Loading } from './ui';
import { useToast } from './feedback';

// V4.1 §11.3–§11.4: lo que GitHub ve es una señal; no valida que se usó ni quién la usó.
const ESTADO_TEC: Record<string, { label: string; tone: 'green' | 'gray' | 'bordo' }> = {
  both: { label: 'Declarada · señal detectada', tone: 'green' },
  declared: { label: 'Declarada', tone: 'gray' },
  detected: { label: 'Señal detectada, no declarada', tone: 'bordo' },
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
export default function ProjectTechnicalCheck({ projectId, canRecheck, onChanged }: { projectId: string; canRecheck: boolean; onChanged?: () => void }) {
  const [c, setC] = useState<ProjectChecks | null>(null);
  const [busy, setBusy] = useState(false);
  const [sug, setSug] = useState<ProjectSuggestions | null>(null);
  const [areaDe, setAreaDe] = useState<Record<string, string>>({});
  const toast = useToast();

  useEffect(() => {
    projectDetailService.checks(projectId).then(setC).catch(() => setC(null));
    projectDetailService.suggestions(projectId).then(setSug).catch(() => setSug(null));
  }, [projectId]);

  const aceptar = async (s: ProjectSuggestions['suggestions'][number]) => {
    const areaId = areaDe[s.skill.id] ?? (s.areas.length === 1 ? s.areas[0].id : '');
    if (!areaId) {
      toast.info('Elige en qué área usaste esta tecnología.');
      return;
    }
    try {
      setSug(await projectDetailService.acceptSuggestion(projectId, { skillId: s.skill.id, areaId, signal: s.signal, source: s.source ?? undefined }));
      toast.success(`${s.skill.name} agregada como tuya.`, 'Queda con su procedencia; el respaldo lo decide la regla, no el clic.');
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const descartar = async (signal: string) => {
    try {
      setSug(await projectDetailService.dismissSuggestion(projectId, signal));
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  const pedir = async (u: ProjectSuggestions['uncatalogued'][number]) => {
    try {
      await projectDetailService.requestSkill(projectId, { name: u.signal, source: u.source ?? undefined });
      toast.success('Pedido enviado a Administración.', 'No suma ni bloquea tu borrador mientras se evalúa.');
      setSug(await projectDetailService.suggestions(projectId));
    } catch (e) {
      toast.error(apiError(e));
    }
  };

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
      {meta?.error && <p className="muted small" data-testid="diagnostico-repo">{meta.error}</p>}
      {sug && (sug.suggestions.length > 0 || sug.uncatalogued.length > 0) && (
        <div className="sugerencias" data-testid="sugerencias-github">
          <strong>Sugerencias a partir de las señales del repositorio</strong>
          <p className="muted small" style={{ margin: '0.2rem 0 0.4rem' }}>
            Una señal no prueba que la usaste. Si la usaste, agrégala tú, con el área en la que la usaste.
          </p>
          <ul className="plain-list">
            {sug.suggestions.map((s) => (
              <li key={s.skill.id} className="flex between" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <span>{s.skill.name} <span className="muted small">· por qué: {s.why}</span></span>
                {canRecheck && (
                  <span className="flex" style={{ gap: '0.35rem' }}>
                    {s.areas.length > 1 && (
                      <select aria-label={`Área de ${s.skill.name}`} value={areaDe[s.skill.id] ?? ''} onChange={(e) => setAreaDe((x) => ({ ...x, [s.skill.id]: e.target.value }))}>
                        <option value="">¿En qué área?</option>
                        {s.areas.map((a) => <option key={a.id} value={a.id}>{a.name}{a.primary ? '' : ' (secundaria)'}</option>)}
                      </select>
                    )}
                    <Button size="sm" onClick={() => aceptar(s)}>La usé</Button>
                    <Button size="sm" variant="ghost" onClick={() => descartar(s.signal)}>Descartar</Button>
                  </span>
                )}
              </li>
            ))}
            {sug.uncatalogued.map((u) => (
              <li key={u.signal} className="flex between" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <span>Tecnología no catalogada: {u.signal} {u.source && <span className="muted small">· {u.source}</span>}</span>
                {canRecheck && (u.requested
                  ? <Badge tone="gray">Pedida a Administración</Badge>
                  : (
                    <span className="flex" style={{ gap: '0.35rem' }}>
                      <Button size="sm" variant="secondary" onClick={() => pedir(u)}>Pedir que la evalúen</Button>
                      <Button size="sm" variant="ghost" onClick={() => descartar(u.signal)}>Descartar</Button>
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </div>
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
