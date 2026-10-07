import { useSearchParams } from 'react-router-dom';
import { FiEyeOff, FiInfo } from 'react-icons/fi';
import { analyticsService, reportService, type DirectorTrends } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import AiAssist from '../../components/AiAssist';
import { CountBars } from '../../components/charts';
import {
  AsyncView, Badge, Card, EmptyState, PageHeader, PanelEmbebido, SkeletonCards, SkeletonTable, Stat, Tabs,
} from '../../components/ui';
import DirectorAffinityMap from './AffinityMap';
import { Tabla, suprimida } from './Trends';

const PESTANAS = [
  { key: 'panorama', label: 'Panorama' },
  { key: 'afinidad', label: 'Afinidad' },
  { key: 'participacion', label: 'Participación' },
  { key: 'demanda', label: 'Demanda' },
  { key: 'evolucion', label: 'Evolución' },
] as const;
type Pestana = (typeof PESTANAS)[number]['key'];

/**
 * Analítica de Dirección (V3 §52).
 *
 * Antes eran tres pantallas que se repetían: Panel, Mapa y Tendencias. Ahora
 * es una, con cinco pestañas que no se pisan:
 *   Panorama      → cuánto hay de cada cosa.
 *   Afinidad      → foto agregada actual de la distribución por áreas.
 *   Participación → inscritos, confirmados y ausentes por contexto.
 *   Demanda       → qué actividades y recursos atraen interés.
 *   Evolución     → cómo cambió en el tiempo.
 * Todo es descriptivo: no se predice rendimiento.
 */
export default function DirectorAnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('tab') as Pestana | null;
  const tab: Pestana = PESTANAS.some((p) => p.key === pedida) ? (pedida as Pestana) : 'panorama';
  // Una sola consulta de tendencias para las pestañas que la usan.
  const tendencias = useAsync(() => analyticsService.directorTrends(), []);

  return (
    <div>
      <PageHeader
        title="Analítica"
        description="Indicadores descriptivos y agregados de la carrera. No representan rendimiento ni predicción."
      />
      <Tabs
        value={tab}
        onChange={(k) => setParams(k === 'panorama' ? {} : { tab: k }, { replace: true })}
        items={PESTANAS.map((p) => ({ key: p.key, label: p.label }))}
      />
      <PanelEmbebido.Provider value>
        {tab === 'panorama' && <Panorama />}
        {tab === 'afinidad' && <DirectorAffinityMap />}
        {tab !== 'panorama' && tab !== 'afinidad' && (
          <AsyncView loading={tendencias.loading} error={tendencias.error} data={tendencias.data} skeleton={<SkeletonCards count={3} />}>
            {(t: DirectorTrends) => (
              <>
                <div className="scope-note">
                  <FiInfo size={16} />
                  <span>{t.note.scope}</span>
                </div>
                {tab === 'participacion' && <Participacion t={t} />}
                {tab === 'demanda' && <Demanda t={t} />}
                {tab === 'evolucion' && <Evolucion t={t} />}
              </>
            )}
          </AsyncView>
        )}
      </PanelEmbebido.Provider>
    </div>
  );
}

function Panorama() {
  const overview = useAsync(() => reportService.directorOverview(), []);
  return (
    <AsyncView loading={overview.loading} error={overview.error} data={overview.data} skeleton={<SkeletonCards count={4} />}>
      {(d: any) => (
        <>
          <div className="grid cols-4">
            <Stat value={d.totals.students} label="Estudiantes" />
            <Stat value={d.totals.projects} label="Proyectos" />
            <Stat value={d.totals.activities} label="Actividades" />
            <Stat value={d.totals.registrations} label="Participaciones" />
          </div>
          {/* V2 §63: la IA redacta sobre estas cifras; no calcula ni inventa. */}
          <AiAssist
            task="ANALYTICS_NARRATIVE"
            label="Lectura narrativa"
            request={() => ({})}
            render={(r) => <p style={{ margin: 0 }}>{r.narrative}</p>}
          />
          <div className="grid cols-2 mt">
            <Card title="Áreas con mayor interés">
              <CountBars data={d.topInterestAreas.map((a: any) => ({ label: a.area, value: a.count }))} />
            </Card>
            <Card title="Habilidades más presentes">
              <CountBars data={d.skillDistribution.slice(0, 10).map((s: any) => ({ label: s.skill, value: s.count }))} />
            </Card>
          </div>
          <Card title="Perfiles">
            <p><strong>Completitud promedio:</strong> {d.trends.averageProfileCompletion}%</p>
            <p><strong>Perfiles completos:</strong> {d.trends.profilesComplete} ({d.trends.profilesCompletePercentage}%)</p>
            <p className="muted">{d.trends.note}</p>
          </Card>
        </>
      )}
    </AsyncView>
  );
}

function Participacion({ t }: { t: DirectorTrends }) {
  const semestre = useAsync(() => reportService.participationBySemester(), []);
  return (
    <>
      <Card title="Por semestre: interés, inscritos, confirmados y ausentes">
        <AsyncView
          loading={semestre.loading}
          error={semestre.error}
          data={semestre.data}
          skeleton={<SkeletonTable rows={4} columns={6} />}
          isEmpty={(d: any) => d.length === 0}
          emptyMessage="Sin participaciones registradas."
        >
          {(rows: any) => (
            <div className="scroll-x">
              <table>
                <thead><tr><th>Semestre</th><th>Total</th><th>Interés</th><th>Inscritos</th><th>Confirmados</th><th>Ausentes</th></tr></thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.semester ? `${r.semester}.º` : 'Sin semestre'}</td><td>{r.total}</td>
                      <td>{r.byStatus.interested}</td><td>{r.byStatus.registered}</td>
                      <td>{r.byStatus.confirmed}</td><td>{r.byStatus.absent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>
      <Card title="Por mes">
        <Tabla
          filas={t.participation}
          columnas={[
            { clave: 'period', titulo: 'Mes' },
            { clave: 'students', titulo: 'Estudiantes', numerica: true },
            { clave: 'registrations', titulo: 'Inscripciones', numerica: true },
            { clave: 'confirmed', titulo: 'Confirmadas', numerica: true },
          ]}
          vacio="Todavía no hay participación registrada."
        />
      </Card>
    </>
  );
}

function Demanda({ t }: { t: DirectorTrends }) {
  return (
    <>
      <Card title="Actividades que más atraen">
        <Tabla
          filas={t.activities}
          columnas={[
            { clave: 'activity', titulo: 'Actividad' },
            { clave: 'area', titulo: 'Área' },
            { clave: 'registrations', titulo: 'Inscripciones', numerica: true },
            { clave: 'confirmed', titulo: 'Confirmadas', numerica: true },
          ]}
          vacio="Todavía no hay actividades con inscripciones."
        />
      </Card>
      <Card title="Recursos más consultados">
        <Tabla
          filas={t.resources ?? []}
          columnas={[
            { clave: 'title', titulo: 'Recurso' },
            { clave: 'opened', titulo: 'Lo abrieron', numerica: true },
            { clave: 'saved', titulo: 'Lo guardaron', numerica: true },
          ]}
          vacio="Todavía nadie abrió un recurso recomendado."
        />
      </Card>
      <Card title="Interés declarado por área">
        <Tabla
          filas={t.interestByArea}
          columnas={[
            { clave: 'area', titulo: 'Área' },
            { clave: 'students', titulo: 'Estudiantes', numerica: true },
            { clave: 'declaredLast90Days', titulo: 'Últimos 90 días', numerica: true },
          ]}
          vacio="Todavía no hay intereses declarados."
        />
      </Card>
      <Card title="Tecnologías en los proyectos">
        <Tabla
          filas={t.technologies}
          columnas={[
            { clave: 'technology', titulo: 'Tecnología' },
            { clave: 'projects', titulo: 'Proyectos', numerica: true },
            { clave: 'students', titulo: 'Estudiantes', numerica: true },
          ]}
          vacio="Todavía no hay proyectos con tecnologías."
        />
      </Card>
    </>
  );
}

function Evolucion({ t }: { t: DirectorTrends }) {
  return (
    <>
      <Card title="Afinidad y respaldo promedio por área, mes a mes">
        <p className="muted" style={{ marginTop: 0 }}>
          Se toma el último cálculo de cada estudiante en cada mes, con el motor vigente.
        </p>
        <Tabla
          filas={t.affinityEvolution ?? []}
          columnas={[
            { clave: 'period', titulo: 'Mes' },
            { clave: 'area', titulo: 'Área' },
            { clave: 'students', titulo: 'Estudiantes', numerica: true },
            { clave: 'averageAffinity', titulo: 'Afinidad media', numerica: true },
            { clave: 'averageSupport', titulo: 'Respaldo medio', numerica: true },
          ]}
          vacio="Todavía no hay cálculos suficientes para ver una evolución."
        />
      </Card>
      <Card title="Áreas predominantes por semestre">
        {t.areasBySemester.length === 0 && <EmptyState message="Todavía no hay afinidades calculadas." />}
        {t.areasBySemester.map((s) => (
          <div key={s.semester} className="necesidad">
            <div className="flex between">
              <strong>{s.semester}.º semestre</strong>
              <Badge tone="gray">{s.students} estudiantes</Badge>
            </div>
            {suprimida(s) ? (
              <p className="muted sin-desglose"><FiEyeOff size={13} /> {s.reason}</p>
            ) : (
              <div className="chip-row">
                {(s.areas ?? []).map((a) => (
                  <span key={a.area} className="chip">
                    {a.area} · {a.students} · afinidad {a.averageAffinity} · respaldo {a.averageSupport}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
