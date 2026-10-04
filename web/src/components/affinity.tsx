import { useState } from 'react';
import { FiChevronDown, FiChevronRight, FiInfo, FiShield } from 'react-icons/fi';
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

/** Familias de prueba de §53 y §54, en las palabras del estudiante. */
export const FAMILY_LABEL: Record<string, string> = {
  preference: 'Lo que declaras (no suma afinidad)',
  activity: 'Actividades',
  project: 'Proyectos',
  external_certificate: 'Certificados externos',
  academic_review: 'Revisión académica',
  other: 'Otras señales',
};

/** Cómo se lee el nivel de respaldo (§49). */
export const SUPPORT_LEVEL_HELP: Record<string, string> = {
  high: 'Varias fuentes independientes sostienen esta área.',
  medium: 'Hay información que la sostiene, pero de un solo tipo o todavía escasa.',
  low: 'Casi todo lo que hay aquí lo declaraste tú y aún no pudo corroborarse.',
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
          <li>Participar en una actividad y que el responsable confirme tu participación</li>
          <li>Registrar un proyecto, conseguirle respaldo y confirmar las tecnologías que usaste</li>
          <li>Adjuntar un certificado externo que se pueda comprobar</li>
        </ul>
      )}
    </div>
  );
}

/**
 * Ranking de areas con los dos puntajes de §49 y el desglose de §91.
 *
 * La barra representa el AFFINITY_SCORE sobre 100, no el peso relativo dentro
 * del perfil. El cambio importa: con el criterio anterior, el area mas fuerte
 * de cualquier estudiante llenaba la barra entera, incluso si su puntaje era
 * minimo. Eso hacia que un perfil vacio pareciera un perfil consolidado.
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
              style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
              aria-expanded={isOpen}
            >
              <div className="flex between">
                <span className="flex" style={{ gap: '0.5rem' }}>
                  {isOpen ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  <strong style={{ color: 'var(--gray-500)' }}>#{a.rank}</strong>
                  <strong>{a.area ?? '—'}</strong>
                </span>
                <span className="flex" style={{ gap: '0.4rem' }}>
                  <Badge tone={(AFFINITY_BADGE[a.level] ?? 'badge-gray').replace('badge-', '')}>
                    Afinidad {a.score}/100
                  </Badge>
                  <Badge tone={(AFFINITY_BADGE[a.supportLevel] ?? 'badge-gray').replace('badge-', '')}>
                    <FiShield size={11} /> Respaldo {lbl(AFFINITY_LEVEL_LABEL, a.supportLevel)}
                  </Badge>
                </span>
              </div>

              <div className="progress" style={{ marginTop: '0.5rem' }}>
                <div
                  style={{
                    width: `${Math.max(2, a.score)}%`,
                    background: LEVEL_COLOR[a.level] ?? LEVEL_COLOR.low,
                  }}
                />
              </div>
              <span className="muted" style={{ fontSize: '0.78rem' }}>
                {a.rawPoints} de {summary.maxRawPoints} puntos posibles · respaldo{' '}
                {a.supportScore}/100 ·{' '}
                {isOpen ? 'ocultar detalle' : 'ver por qué'}
              </span>
            </button>

            {isOpen && loadingArea === a.academicAreaId && <Loading />}

            {isOpen && detail && <AffinityDetail detail={detail} />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * El desglose tal como lo pide §91: primero por que suma, y despues que se
 * tuvo en cuenta y **no** sumo.
 *
 * La segunda lista es la que de verdad orienta. La pregunta de un estudiante
 * casi nunca es «por que tengo 60»; es «por que no tengo mas», y sin esa lista
 * la unica respuesta posible era el silencio.
 */
function AffinityDetail({ detail }: { detail: AffinityBreakdown }) {
  const fila = (c: AffinityBreakdown['contributions'][number], i: number) => (
    <tr key={`${c.sourceId ?? 'x'}-${i}`}>
      <td>{c.reason ?? c.sourceLabel}</td>
      <td className="muted">
        {lbl(FAMILY_LABEL, c.signalFamily)}
        <br />
        <span style={{ fontSize: '0.74rem' }}>{lbl(MATCH_LABEL, c.matchType)}</span>
      </td>
      <td className="muted" style={{ whiteSpace: 'nowrap' }}>
        {c.multiplier < 1 ? `${c.rawPoints} × ${c.multiplier}` : ''}
      </td>
      <td style={{ textAlign: 'right' }}>{c.points > 0 ? `+${c.points}` : '—'}</td>
      <td style={{ textAlign: 'right' }}>{c.supportPoints > 0 ? `+${c.supportPoints}` : '—'}</td>
    </tr>
  );

  return (
    <div style={{ marginTop: '0.6rem' }}>
      <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <Badge tone="bordo">
          Afinidad {detail.score}/100 · {detail.rawPoints} de {detail.maxRawPoints} puntos
        </Badge>
        <Badge tone={(AFFINITY_BADGE[detail.supportLevel ?? 'low'] ?? 'badge-gray').replace('badge-', '')}>
          Respaldo {detail.supportScore}/100 · {lbl(AFFINITY_LEVEL_LABEL, detail.supportLevel ?? 'low')}
        </Badge>
      </div>

      <p className="muted" style={{ marginTop: 0, fontSize: '0.8rem' }}>
        {SUPPORT_LEVEL_HELP[detail.supportLevel ?? 'low']}
        {detail.supportFamilies.length > 0 && (
          <> Familias que lo sostienen: {detail.supportFamilies.map((f) => lbl(FAMILY_LABEL, f)).join(', ')}.</>
        )}
      </p>

      <h4 style={{ margin: '0.8rem 0 0.4rem' }}>¿Por qué?</h4>
      {detail.contributing.length === 0 ? (
        <p className="muted">Todavía no hay ninguna señal que sume en esta área.</p>
      ) : (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Origen</th>
                <th>Familia</th>
                <th>Cálculo</th>
                <th style={{ textAlign: 'right' }}>Afinidad</th>
                <th style={{ textAlign: 'right' }}>Respaldo</th>
              </tr>
            </thead>
            <tbody>
              {detail.contributing.map(fila)}
              <tr>
                <td colSpan={3}><strong>Total del área</strong></td>
                <td style={{ textAlign: 'right' }}><strong>{detail.rawPoints}</strong></td>
                <td style={{ textAlign: 'right' }}><strong>{detail.supportScore}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {detail.notContributing.length > 0 && (
        <>
          <h4 style={{ margin: '1rem 0 0.4rem' }}>No contribuye</h4>
          <ul className="plain-list">
            {detail.notContributing.map((c, i) => (
              <li key={`${c.sourceId ?? 'n'}-${i}`} className="muted" style={{ fontSize: '0.82rem' }}>
                {c.reason ?? c.sourceLabel}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
