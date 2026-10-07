import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { FiEyeOff, FiInfo } from 'react-icons/fi';
import { analyticsService, type SocietyMetrics } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import AiAssist from '../../components/AiAssist';
import { ACTIVITY_STATUS_LABEL, lbl } from '../../constants';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, SkeletonCards,
} from '../../components/ui';

const FECHA = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

type Fila = SocietyMetrics['activities'][number];

/**
 * Métricas de la sociedad científica (§65; V3 §53).
 *
 * §65 le concede exactamente esto: *«Sociedad: métricas de sus actividades»*.
 * No hay perfiles, ni afinidades, ni proyectos — no porque se hayan ocultado en
 * la pantalla, sino porque el servidor no los devuelve por esta puerta.
 *
 * V3 §53: métricas interactivas — periodo, categoría, área, comparación con
 * el periodo anterior y clic a cada actividad —, no un panel estático.
 */
export default function SocietyMetricsPage() {
  const state = useAsync(() => analyticsService.societyMetrics(), []);

  return (
    <div>
      <PageHeader
        title="Métricas de mis actividades"
        description="Cuánta participación tuvieron las actividades que organizaste."
      />
      <AsyncView loading={state.loading} error={state.error} data={state.data} skeleton={<SkeletonCards count={2} />}>
        {(m: SocietyMetrics) => <Contenido m={m} />}
      </AsyncView>
    </div>
  );
}

interface Totales { activities: number; registrations: number; confirmed: number; absent: number }

function sumar(filas: Fila[]): Totales {
  const t: Totales = { activities: 0, registrations: 0, confirmed: 0, absent: 0 };
  for (const a of filas) {
    t.activities += 1;
    t.registrations += a.registrations ?? 0;
    // Una fila suprimida (§65) no desglosa: no suma confirmadas ni ausencias.
    if (!a.suppressed) {
      t.confirmed += a.confirmed ?? 0;
      t.absent += a.absent ?? 0;
    }
  }
  return t;
}

function Contenido({ m }: { m: SocietyMetrics }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [categoria, setCategoria] = useState('');
  const [area, setArea] = useState('');

  const categorias = useMemo(() => [...new Set(m.activities.map((a) => a.category).filter((x): x is string => !!x))].sort(), [m]);
  const areas = useMemo(() => [...new Set(m.activities.map((a) => a.area).filter((x): x is string => !!x))].sort(), [m]);

  const enRango = (a: Fila, ini: number | null, fin: number | null) => {
    if (ini === null && fin === null) return true;
    if (!a.eventDate) return false;
    const t = new Date(a.eventDate).getTime();
    return (ini === null || t >= ini) && (fin === null || t <= fin);
  };
  const ini = desde ? new Date(`${desde}T00:00:00`).getTime() : null;
  const fin = hasta ? new Date(`${hasta}T23:59:59`).getTime() : null;
  const pasaFiltros = (a: Fila) => (!categoria || a.category === categoria) && (!area || a.area === area);

  const filas = m.activities.filter((a) => pasaFiltros(a) && enRango(a, ini, fin));
  const actual = sumar(filas);
  // Comparación: el periodo inmediatamente anterior, del mismo largo.
  const anterior = ini !== null && fin !== null
    ? sumar(m.activities.filter((a) => pasaFiltros(a) && enRango(a, ini - (fin - ini) - 1, ini - 1)))
    : null;
  const delta = (k: keyof typeof actual) => {
    if (!anterior) return null;
    const d = actual[k] - anterior[k];
    return <span className={`delta ${d > 0 ? 'sube' : d < 0 ? 'baja' : ''}`}>{d > 0 ? `+${d}` : d} vs. periodo anterior</span>;
  };
  const filtrando = !!(desde || hasta || categoria || area);

  const porCategoria = categorias.map((c) => ({ category: c, ...sumar(filas.filter((a) => a.category === c)) }))
    .filter((c) => c.activities > 0);

  return (
    <>
      <div className="scope-note">
        <FiInfo size={16} />
        <span>{m.note.scope}</span>
      </div>

      <Card title="Filtros">
        <div className="filtros-metricas">
          <div className="field">
            <label htmlFor="met-desde">Desde</label>
            <input id="met-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="met-hasta">Hasta</label>
            <input id="met-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="met-cat">Categoría</label>
            <select id="met-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="met-area">Área</label>
            <select id="met-area" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Todas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        {filtrando && (
          <Button size="sm" variant="ghost" onClick={() => { setDesde(''); setHasta(''); setCategoria(''); setArea(''); }}>
            Quitar filtros
          </Button>
        )}
        {(desde || hasta) && !anterior && (
          <p className="muted" style={{ marginBottom: 0 }}>Elige «Desde» y «Hasta» para comparar con el periodo anterior.</p>
        )}
      </Card>

      <Card>
        <div className="metricas">
          <div><div className="metrica-valor">{actual.activities}</div><span className="muted">actividades</span>{delta('activities')}</div>
          <div><div className="metrica-valor">{actual.registrations}</div><span className="muted">inscripciones</span>{delta('registrations')}</div>
          <div><div className="metrica-valor">{actual.confirmed}</div><span className="muted">participaciones confirmadas</span>{delta('confirmed')}</div>
          <div><div className="metrica-valor">{actual.absent}</div><span className="muted">ausencias</span>{delta('absent')}</div>
          {!filtrando && (
            <>
              <div><div className="metrica-valor">{m.totals.students}</div><span className="muted">estudiantes distintos</span></div>
              <div><div className="metrica-valor">{m.totals.returningStudents ?? 0}</div><span className="muted">volvieron a participar</span></div>
            </>
          )}
        </div>
        {/* V2 §64: la IA solo redacta sobre estas cifras. */}
        <AiAssist
          task="ANALYTICS_NARRATIVE"
          label="Lectura narrativa"
          request={() => ({})}
          render={(r) => <p style={{ margin: 0 }}>{r.narrative}</p>}
        />
      </Card>

      {porCategoria.length > 0 && (
        <Card title="Por categoría">
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th style={{ textAlign: 'right' }}>Actividades</th>
                  <th style={{ textAlign: 'right' }}>Inscripciones</th>
                  <th style={{ textAlign: 'right' }}>Confirmadas</th>
                  <th style={{ textAlign: 'right' }}>Ausencias</th>
                </tr>
              </thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.category} className="fila-clic" onClick={() => setCategoria(c.category)} title="Filtrar por esta categoría">
                    <td>{c.category}</td>
                    <td style={{ textAlign: 'right' }}>{c.activities}</td>
                    <td style={{ textAlign: 'right' }}>{c.registrations}</td>
                    <td style={{ textAlign: 'right' }}>{c.confirmed}</td>
                    <td style={{ textAlign: 'right' }}>{c.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Actividad por actividad">
        {filas.length === 0 && (
          <EmptyState message={m.activities.length === 0 ? 'Todavía no organizaste ninguna actividad.' : 'Ninguna actividad coincide con los filtros.'} />
        )}
        {filas.length > 0 && (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Inscripciones</th>
                  <th style={{ textAlign: 'right' }}>Confirmadas</th>
                  <th style={{ textAlign: 'right' }}>Ausencias</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((a) => (
                  <tr key={a.activityId}>
                    <td><Link to={`/society/activities?actividad=${a.activityId}`}>{a.title}</Link></td>
                    <td className="muted">{FECHA(a.eventDate)}</td>
                    <td><Badge tone="gray">{lbl(ACTIVITY_STATUS_LABEL, a.status ?? '')}</Badge></td>
                    <td style={{ textAlign: 'right' }}>{a.registrations}</td>
                    {a.suppressed ? (
                      /* §65: con muy pocos inscritos, el detalle identifica
                         a las personas. La sociedad sabe quiénes son. */
                      <td className="muted sin-desglose" colSpan={2}>
                        <FiEyeOff size={12} /> {a.reason}
                      </td>
                    ) : (
                      <>
                        <td style={{ textAlign: 'right' }}>{a.confirmed}</td>
                        <td style={{ textAlign: 'right' }}>{a.absent ?? 0}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
