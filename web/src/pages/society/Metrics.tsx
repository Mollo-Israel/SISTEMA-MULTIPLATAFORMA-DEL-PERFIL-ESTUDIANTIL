import { FiEyeOff, FiInfo } from 'react-icons/fi';
import { analyticsService, type SocietyMetrics } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Card, EmptyState, PageHeader, SkeletonCards,
} from '../../components/ui';

const FECHA = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * Métricas de la sociedad científica (§65).
 *
 * §65 le concede exactamente esto: *«Sociedad: métricas de sus actividades»*.
 * No hay perfiles, ni afinidades, ni proyectos — no porque se hayan ocultado en
 * la pantalla, sino porque el servidor no los devuelve por esta puerta.
 */
export default function SocietyMetricsPage() {
  const state = useAsync(() => analyticsService.societyMetrics(), []);

  return (
    <div>
      <PageHeader
        title="Métricas de mis actividades"
        description="Cuánta participación tuvieron las actividades que organizaste."
      />

      <AsyncView
        loading={state.loading}
        error={state.error}
        data={state.data}
        skeleton={<SkeletonCards count={2} />}
      >
        {(m: SocietyMetrics) => (
          <>
            <div className="scope-note">
              <FiInfo size={16} />
              <span>{m.note.scope}</span>
            </div>

            <Card>
              <div className="metricas">
                <div>
                  <div className="metrica-valor">{m.totals.activities}</div>
                  <span className="muted">actividades</span>
                </div>
                <div>
                  <div className="metrica-valor">{m.totals.registrations}</div>
                  <span className="muted">inscripciones</span>
                </div>
                <div>
                  <div className="metrica-valor">{m.totals.confirmed}</div>
                  <span className="muted">participaciones confirmadas</span>
                </div>
                <div>
                  <div className="metrica-valor">{m.totals.students}</div>
                  <span className="muted">estudiantes distintos</span>
                </div>
              </div>
            </Card>

            <Card title="Actividad por actividad">
              {m.activities.length === 0 && (
                <EmptyState message="Todavía no organizaste ninguna actividad." />
              )}
              {m.activities.length > 0 && (
                <div className="scroll-x">
                  <table>
                    <thead>
                      <tr>
                        <th>Actividad</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th style={{ textAlign: 'right' }}>Inscripciones</th>
                        <th style={{ textAlign: 'right' }}>Confirmadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.activities.map((a) => (
                        <tr key={a.activityId}>
                          <td>{a.title}</td>
                          <td className="muted">{FECHA(a.eventDate)}</td>
                          <td><Badge tone="gray">{a.status}</Badge></td>
                          <td style={{ textAlign: 'right' }}>{a.registrations}</td>
                          {a.suppressed ? (
                            /* §65: con muy pocos inscritos, el detalle identifica
                               a las personas. La sociedad sabe quiénes son. */
                            <td className="muted sin-desglose">
                              <FiEyeOff size={12} /> {a.reason}
                            </td>
                          ) : (
                            <td style={{ textAlign: 'right' }}>{a.confirmed}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </AsyncView>
    </div>
  );
}
