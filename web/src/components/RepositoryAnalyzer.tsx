import { useState } from 'react';
import { FiCheck, FiGithub, FiRefreshCw, FiX } from 'react-icons/fi';
import { apiError } from '../api/client';
import { projectService } from '../services';
import type { RepositoryAnalysis } from '../services';
import { Badge, Button } from './ui';

/**
 * «Analizar repositorio» en el alta de un proyecto (V5 §11.1).
 *
 * Es opcional: el borrador se guarda con o sin análisis, y si GitHub no
 * responde nada de lo elegido se borra (F01, F06). Lo detectado se ofrece; el
 * estudiante decide qué incluir y en qué área se usó cuando la tecnología
 * tiene varias (F11). Volver a analizar no duplica nada: se identifica por la
 * tecnología del catálogo (F05). Lo descartado no se vuelve a ofrecer en esta
 * sesión salvo un análisis nuevo de otro repositorio.
 */
export default function RepositoryAnalyzer({
  repositoryUrl,
  elegidas,
  areasElegidas,
  maxAreas,
  onIncluir,
}: {
  repositoryUrl: string;
  /** Tecnologías ya elegidas en el formulario (no se vuelven a ofrecer). */
  elegidas: string[];
  areasElegidas: string[];
  maxAreas: number;
  onIncluir: (s: { skillId: string; areaId: string; source: string }) => void;
}) {
  const [analisis, setAnalisis] = useState<RepositoryAnalysis | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set());
  const [areaDe, setAreaDe] = useState<Record<string, string>>({});

  const analizar = async () => {
    if (!repositoryUrl.trim()) {
      setError('Escribe primero el enlace del repositorio.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const r = await projectService.analyzeRepository(repositoryUrl.trim());
      // Otro repositorio: lo descartado del anterior se puede volver a ofrecer.
      if (analisis && analisis.repositoryUrl !== r.repositoryUrl) setDescartadas(new Set());
      setAnalisis(r);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setCargando(false);
    }
  };

  const pendientes = (analisis?.suggestions ?? [])
    .filter((s) => !elegidas.includes(s.skill.id) && !descartadas.has(s.skill.id));
  const incluidas = (analisis?.suggestions ?? []).filter((s) => elegidas.includes(s.skill.id));

  return (
    <div className="field repo-analyzer" data-testid="analizar-repositorio">
      <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={analisis ? <FiRefreshCw size={14} /> : <FiGithub size={14} />}
          loading={cargando}
          onClick={() => void analizar()}
        >
          {analisis ? 'Volver a analizar' : 'Analizar repositorio'}
        </Button>
        <span className="muted small">Opcional. Puedes guardar el borrador sin analizar y elegir las tecnologías a mano.</span>
      </div>
      {error && <span className="field-error" role="alert">{error}</span>}
      {analisis && analisis.status !== 'ANALYZED' && (
        <p className="notice notice-warn small" role="status" data-testid="analisis-inconcluso">
          {analisis.status === 'INCONCLUSIVE' && <strong>No se pudo concluir. </strong>}
          {analisis.message} Lo que ya elegiste se conserva.
        </p>
      )}
      {analisis?.status === 'ANALYZED' && (
        <div className="stack" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
          <p className="muted small" style={{ margin: 0 }}>
            Esto está en el repositorio; no dice quién lo usó. Cada integrante confirma después su propia contribución.
          </p>
          {analisis.message && <p className="muted small" style={{ margin: 0 }}>{analisis.message}</p>}
          {pendientes.length > 0 && (
            <ul className="plain-list" data-testid="sugerencias-analisis">
              {pendientes.map((s) => {
                const varias = s.areas.length > 1;
                const area = areaDe[s.skill.id] ?? (s.areas.find((a) => areasElegidas.includes(a.id)) ?? s.areas.find((a) => a.primary) ?? s.areas[0])?.id;
                const nuevaArea = !!area && !areasElegidas.includes(area);
                const sinLugar = nuevaArea && areasElegidas.length >= maxAreas;
                return (
                  <li key={s.skill.id} className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>{s.skill.name}</strong>
                    <Badge tone="gray">{s.why}</Badge>
                    {varias ? (
                      <select aria-label={`Área en la que se usó ${s.skill.name}`} value={area}
                        onChange={(e) => setAreaDe({ ...areaDe, [s.skill.id]: e.target.value })}>
                        {s.areas.map((a) => <option key={a.id} value={a.id}>{a.name}{a.primary ? ' (principal)' : ''}</option>)}
                      </select>
                    ) : (
                      <span className="muted small">{s.areas[0]?.name ?? 'Sin área'}</span>
                    )}
                    <Button type="button" size="sm" icon={<FiCheck size={13} />} disabled={!area || sinLugar}
                      title={sinLugar ? `Ya hay ${maxAreas} áreas: quita una para incluir esta.` : undefined}
                      onClick={() => area && onIncluir({ skillId: s.skill.id, areaId: area, source: s.why })}>
                      Incluir
                    </Button>
                    <Button type="button" size="sm" variant="secondary" icon={<FiX size={13} />}
                      onClick={() => setDescartadas(new Set([...descartadas, s.skill.id]))}>
                      Descartar
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {incluidas.length > 0 && (
            <p className="small" style={{ margin: 0 }}>
              Incluidas desde el repositorio: {incluidas.map((s) => s.skill.name).join(', ')}.
            </p>
          )}
          {analisis.uncatalogued.length > 0 && (
            <p className="muted small" style={{ margin: 0 }}>
              Detectadas pero no están en el catálogo: {analisis.uncatalogued.map((u) => u.signal).join(', ')}.
              Al guardar el proyecto puedes pedir que se agreguen.
            </p>
          )}
          {pendientes.length === 0 && incluidas.length === 0 && analisis.suggestions.length > 0 && (
            <p className="muted small" style={{ margin: 0 }}>Descartaste todas las sugerencias.</p>
          )}
        </div>
      )}
    </div>
  );
}
