import { Link } from 'react-router-dom';
import { FiBarChart2, FiPlus, FiUsers } from 'react-icons/fi';
import { analyticsService, type SocietyMetrics } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Badge, Card, EmptyState, PageHeader, SkeletonCards, Stat } from '../../components/ui';
import { ACTIVITY_STATUS_LABEL, lbl } from '../../constants';

const FECHA = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }) : 'Sin fecha';

/**
 * Inicio de la Sociedad científica (V3 §53): un resumen breve y lo próximo.
 * Las métricas con filtros y comparación están en «Métricas»; aquí no se
 * repite un panel estático.
 */
export default function SocietyDashboard() {
  const state = useAsync(() => analyticsService.societyMetrics(), []);
  return (
    <div>
      <PageHeader
        title="Inicio"
        description="Tus actividades extracurriculares de un vistazo."
        actions={
          <Link to="/society/activities?nuevo=1" className="btn btn-primary">
            <FiPlus size={15} /> Crear actividad
          </Link>
        }
      />
      <AsyncView loading={state.loading} error={state.error} data={state.data} skeleton={<SkeletonCards count={3} />}>
        {(m: SocietyMetrics) => {
          const hoy = Date.now();
          const proximas = m.activities
            .filter((a) => a.eventDate && new Date(a.eventDate).getTime() >= hoy)
            .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
            .slice(0, 5);
          const enRevision = m.activities.filter((a) => a.status === 'draft').length;
          return (
            <>
              <div className="grid cols-4">
                <Stat value={m.totals.activities} label="Actividades" />
                <Stat value={m.totals.registrations} label="Inscripciones" />
                <Stat value={m.totals.confirmed} label="Participaciones confirmadas" />
                <Stat value={enRevision} label="En borrador o en revisión" />
              </div>
              <Card
                title="Próximas"
                actions={<Link to="/society/participants" className="btn btn-ghost btn-sm"><FiUsers size={13} /> Participantes</Link>}
              >
                {proximas.length === 0 ? (
                  <EmptyState message="No tienes actividades próximas." action={<Link to="/society/activities?nuevo=1" className="btn btn-secondary btn-sm">Crear una</Link>} />
                ) : (
                  <ul className="plain-list">
                    {proximas.map((a) => (
                      <li key={a.activityId} className="flex between" style={{ gap: '0.5rem', flexWrap: 'wrap', padding: '0.4rem 0' }}>
                        <Link to={`/society/activities?actividad=${a.activityId}`}>{a.title}</Link>
                        <span className="flex" style={{ gap: '0.35rem' }}>
                          <span className="muted">{FECHA(a.eventDate)}</span>
                          <Badge tone="gray">{lbl(ACTIVITY_STATUS_LABEL, a.status ?? '')}</Badge>
                          <Badge tone="bordo">{a.registrations} inscritos</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Métricas" actions={<Link to="/society/metrics" className="btn btn-secondary btn-sm"><FiBarChart2 size={13} /> Ver métricas</Link>}>
                <p className="muted" style={{ margin: 0 }}>
                  Filtra por periodo, categoría o área, compara con el periodo anterior y entra a cada actividad.
                </p>
              </Card>
            </>
          );
        }}
      </AsyncView>
    </div>
  );
}
