import { Link } from 'react-router-dom';
import { FiArrowRight, FiBarChart2, FiCheckSquare, FiFileText, FiShield } from 'react-icons/fi';
import { useAsync } from '../../hooks/useAsync';
import { reportService, type DirectorPending } from '../../services';
import { AsyncView, Card, PageHeader, SkeletonCards, Stat } from '../../components/ui';

/**
 * Inicio de Dirección (V3 §52): lo que hay que atender y cuatro cifras. La
 * analítica completa está en «Analítica»; aquí no se repite.
 */
export default function DirectorDashboard() {
  const pendientes = useAsync(() => reportService.directorPending(), []);
  const overview = useAsync(() => reportService.directorOverview(), []);

  return (
    <div>
      <PageHeader
        title="Inicio"
        description="Lo que espera tu decisión y un vistazo a la carrera."
      />

      <AsyncView loading={pendientes.loading} error={pendientes.error} data={pendientes.data} skeleton={<SkeletonCards count={3} />}>
        {(p: DirectorPending) => (
          <div className="grid cols-3">
            <Pendiente
              to="/director/approvals"
              icon={<FiCheckSquare />}
              n={p.activitiesPendingReview}
              titulo="Actividades por aprobar"
              detalle={p.activitiesObserved ? `${p.activitiesObserved} observada(s) esperando correcciones` : 'Propuestas de docentes y sociedad'}
            />
            <Pendiente
              to="/director/credential-reviews"
              icon={<FiShield />}
              n={p.credentialsPendingManualReview}
              titulo="Credenciales en revisión"
              detalle="Revisión manual excepcional"
            />
            <Pendiente
              to="/director/constancies"
              icon={<FiFileText />}
              n={p.constanciesPending}
              titulo="Constancias pendientes"
              detalle="Participaciones confirmadas por emitir"
            />
          </div>
        )}
      </AsyncView>

      <AsyncView loading={overview.loading} error={overview.error} data={overview.data} skeleton={<SkeletonCards count={4} />}>
        {(d: any) => (
          <div className="grid cols-4 mt">
            <Stat value={d.totals.students} label="Estudiantes" />
            <Stat value={d.totals.projects} label="Proyectos" />
            <Stat value={d.totals.activities} label="Actividades" />
            <Stat value={d.totals.registrations} label="Participaciones" />
          </div>
        )}
      </AsyncView>

      <Card title="Analítica" actions={<Link to="/director/analytics" className="btn btn-secondary btn-sm"><FiBarChart2 size={13} /> Abrir</Link>}>
        <div className="chip-row">
          {[
            ['', 'Panorama'], ['afinidad', 'Afinidad'], ['participacion', 'Participación'], ['demanda', 'Demanda'], ['evolucion', 'Evolución'],
          ].map(([k, l]) => (
            <Link key={l} className="chip" to={k ? `/director/analytics?tab=${k}` : '/director/analytics'}>{l}</Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Pendiente({ to, icon, n, titulo, detalle }: { to: string; icon: React.ReactNode; n: number; titulo: string; detalle: string }) {
  return (
    <Link to={to} className={`card pendiente ${n > 0 ? 'con' : ''}`}>
      <span className="qi" aria-hidden>{icon}</span>
      <span className="pendiente-n">{n}</span>
      <strong>{titulo}</strong>
      <span className="muted">{detalle}</span>
      <span className="stat-accion">Ir <FiArrowRight size={12} /></span>
    </Link>
  );
}
