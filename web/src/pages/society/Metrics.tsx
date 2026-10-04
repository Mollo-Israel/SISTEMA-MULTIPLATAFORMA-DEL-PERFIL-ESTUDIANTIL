import { FiEyeOff, FiInfo } from 'react-icons/fi';
import { analyticsService, type SocietyMetrics } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import AiAssist from '../../components/AiAssist';
import { ACTIVITY_STATUS_LABEL, lbl } from '../../constants';
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
                  <div className="metrica-valor">{m.totals.absent ?? 0}</div>
                  <span className="muted">ausencias</span>
                </div>
                <div>
                  <div className="metrica-valor">{m.totals.students}</div>
                  <span className="muted">estudiantes distintos</span>
                </div>
                <div>
                  <div className="metrica-valor">{m.totals.returningStudents ?? 0}</div>
                  <span className="muted">volvieron a participar</span>
                </div>
              </div>
              {/* V2 §64: la IA solo redacta sobre estas cifras. */}
              <AiAssist
                task="ANALYTICS_NARRATIVE"
                label="Lectura narrativa"
                request={() => ({})}
                render={(r) => <p style={{ margin: 0 }}>{r.narrative}</p>}
              />
            </Card>

            {(m.byCategory ?? []).length > 0 && (
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
                      {m.byCategory!.map((c) => (
                        <tr key={c.category}>
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
                        <th style={{ textAlign: 'right' }}>Ausencias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.activities.map((a) => (
                        <tr key={a.activityId}>
                          <td>{a.title}</td>
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
        )}
      </AsyncView>
    </div>
  );
}
