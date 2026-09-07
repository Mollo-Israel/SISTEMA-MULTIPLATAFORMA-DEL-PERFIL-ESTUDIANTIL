import { useState } from 'react';
import { FiChevronDown, FiChevronRight, FiInfo } from 'react-icons/fi';
import { apiError } from '../api/client';
import { AffinityBreakdown, AffinitySummary } from '../services';
import { AFFINITY_BADGE, AFFINITY_LEVEL_LABEL, lbl } from '../constants';
import { Badge, Loading } from './ui';

/**
 * Presentacion compartida de las afinidades (RF17).
 *
 * La usan la pantalla del estudiante y la consulta del docente. Se comparte a
 * proposito: si cada una construyera su propia lectura del puntaje, con el
 * tiempo acabarian mostrando cosas distintas sobre los mismos datos, que es
 * justo lo que un motor de orientacion no puede permitirse.
 *
 * Quien consulta el desglose se decide fuera, con `loadBreakdown`: el
 * estudiante pide el suyo y el docente el de un estudiante de su alcance. El
 * permiso lo aplica el backend en ambos casos.
 */

export const SIGNAL_LABEL: Record<string, string> = {
  interest: 'Interés declarado',
  skill: 'Habilidad',
  improvement_area: 'Área de mejora',
  activity: 'Actividad',
  project: 'Proyecto',
  evidence: 'Evidencia',
  certificate: 'Certificado externo',
  constancy: 'Constancia interna',
};

export const MATCH_LABEL: Record<string, string> = {
  declared: 'área declarada',
  tag: 'deducida por tecnologías',
  text: 'deducida por coincidencia de texto',
  inherited: 'heredada de la actividad o proyecto',
};

const LEVEL_COLOR: Record<string, string> = {
  high: 'var(--green, #1f7a4d)',
  medium: 'var(--amber, #b6791f)',
  low: 'var(--gray-500, #7b828c)',
};

export const formatDateTime = (value: string | null) => {
  if (!value) return 'sin calcular';
  const d = new Date(value);
  return `${d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Aviso de RN-15. Aparece en toda vista de afinidad, tanto del estudiante como
 * del docente: la regla dice que estos resultados no sirven para evaluar
 * rendimiento ni tomar decisiones academicas formales, y quien los lee tiene
 * que saberlo sin buscarlo.
 */
export function AffinityDisclaimer({ forTeacher = false }: { forTeacher?: boolean }) {
  return (
    <div className="scope-note">
      <FiInfo size={16} />
      <span>
        {forTeacher
          ? 'Orientación complementaria para acompañar al estudiante. No es una evaluación ni sustituye una calificación.'
          : 'Orientación calculada con reglas y puntuación sobre tu perfil. No es una nota ni una evaluación académica.'}
      </span>
    </div>
  );
}

/** Estado de RF17 cuando todavia no hay con que orientar. */
export function AffinityInsufficient({
  message,
  forTeacher = false,
}: {
  message: string;
  forTeacher?: boolean;
}) {
  return (
    <div className="state">
      <p className="muted">{message}</p>
      {!forTeacher && (
        <ul className="plain-list" style={{ textAlign: 'left', maxWidth: 420, margin: '0.8rem auto 0' }}>
          <li>Registrar un proyecto en tu portafolio</li>
          <li>Adjuntar un certificado externo</li>
          <li>Participar en una actividad y que te confirmen</li>
          <li>Declarar tus intereses y habilidades</li>
        </ul>
      )}
    </div>
  );
}

/**
 * Ranking de areas con nivel, peso relativo y desglose desplegable.
 *
 * La barra representa el peso relativo respecto al area mas fuerte del propio
 * estudiante, que es exactamente el criterio con el que se clasifica el nivel.
 */
export function AffinityRanking({
  summary,
  loadBreakdown,
}: {
  summary: AffinitySummary;
  loadBreakdown: (areaId: string) => Promise<AffinityBreakdown>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, AffinityBreakdown>>({});
  const [loadingArea, setLoadingArea] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (areaId: string) => {
    if (open === areaId) {
      setOpen(null);
      return;
    }
    setOpen(areaId);
    setError(null);
    if (cache[areaId]) return;
    setLoadingArea(areaId);
    try {
      const data = await loadBreakdown(areaId);
      setCache((prev) => ({ ...prev, [areaId]: data }));
    } catch (e) {
      setError(apiError(e));
      setOpen(null);
    } finally {
      setLoadingArea(null);
    }
  };

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {summary.areas.map((a) => {
        const isOpen = open === a.academicAreaId;
        const detail = cache[a.academicAreaId];
        return (
          <div
            key={a.academicAreaId}
            style={{ borderBottom: '1px solid var(--gray-100)', padding: '0.7rem 0' }}
          >
            <button
              type="button"
              onClick={() => toggle(a.academicAreaId)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'block',
                width: '100%',
              }}
              aria-expanded={isOpen}
            >
              <div className="flex between">
                <span className="flex" style={{ gap: '0.5rem' }}>
                  {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  <strong style={{ color: 'var(--gray-500)' }}>#{a.rank}</strong>
                  <strong>{a.area ?? '—'}</strong>
                </span>
                <Badge tone={(AFFINITY_BADGE[a.level] ?? 'badge-gray').replace('badge-', '')}>
                  {lbl(AFFINITY_LEVEL_LABEL, a.level)} · {a.score}
                </Badge>
              </div>

              <div className="progress" style={{ marginTop: '0.5rem' }}>
                <div
                  style={{
                    width: `${Math.max(4, Math.round(a.share * 100))}%`,
                    background: LEVEL_COLOR[a.level] ?? LEVEL_COLOR.low,
                  }}
                />
              </div>
              <span className="muted" style={{ fontSize: '0.78rem' }}>
                {Math.round(a.share * 100)}% respecto al área más fuerte ·{' '}
                {isOpen ? 'ocultar detalle' : 'ver por qué'}
              </span>
            </button>

            {isOpen && loadingArea === a.academicAreaId && <Loading />}

            {isOpen && detail && (
              <div className="scroll-x" style={{ marginTop: '0.6rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Origen</th>
                      <th>Señal</th>
                      <th>Coincidencia</th>
                      <th style={{ textAlign: 'right' }}>Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.contributions.map((c, i) => (
                      <tr key={`${c.sourceId ?? 'x'}-${i}`}>
                        <td>{c.sourceLabel}</td>
                        <td className="muted">{lbl(SIGNAL_LABEL, c.signalType)}</td>
                        <td className="muted">{lbl(MATCH_LABEL, c.matchType)}</td>
                        <td style={{ textAlign: 'right' }}>+{c.points}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3}>
                        <strong>Total del área</strong>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{detail.score}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
