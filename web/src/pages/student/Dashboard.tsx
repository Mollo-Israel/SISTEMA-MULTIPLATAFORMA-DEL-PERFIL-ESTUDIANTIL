import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { profileService } from '../../services';
import { AsyncView, Card, Stat, Badge } from '../../components/ui';
import { AFFINITY_BADGE } from '../../constants';

export default function StudentDashboard() {
  const summary = useAsync(() => profileService.summary().catch(() => null), []);

  return (
    <div>
      <h1>Mi panel</h1>
      <p className="muted">Tu perfil se construye con lo que declaras y con tu actividad académica.</p>

      {!summary.loading && !summary.data && (
        <Card title="Aún no tienes perfil">
          <p className="muted">Crea tu perfil dinámico para empezar a construir tu portafolio académico.</p>
          <Link to="/student/profile" className="btn btn-primary mt">Crear mi perfil</Link>
        </Card>
      )}

      <AsyncView loading={summary.loading} error={summary.error} data={summary.data} emptyMessage="">
        {(data) => (
          <>
            <div className="grid cols-4">
              <Stat value={`${data.profile.completionPercentage}%`} label="Perfil completo" />
              <Stat value={data.projects.length} label="Proyectos" />
              <Stat value={data.activities.length} label="Actividades" />
              <Stat value={data.affinities.length} label="Áreas de afinidad" />
            </div>

            <div className="grid cols-2 mt">
              <Card title="Tus áreas de afinidad" actions={<Link to="/student/affinity" className="btn btn-ghost btn-sm">Ver todo</Link>}>
                {data.affinities.length === 0 ? (
                  <p className="muted">Sin afinidades calculadas todavía. Agrega intereses, habilidades y proyectos.</p>
                ) : (
                  <table>
                    <tbody>
                      {data.affinities.slice(0, 5).map((a) => (
                        <tr key={a.academicAreaId}>
                          <td>{a.area}</td>
                          <td style={{ width: 70 }}>{a.score}</td>
                          <td style={{ width: 80 }}><Badge tone={(AFFINITY_BADGE[a.level] ?? 'badge-gray').replace('badge-', '')}>{a.level}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>

              <Card title="Resumen del perfil">
                <p><strong>Semestre:</strong> {data.profile.semester ?? '—'}</p>
                <p><strong>Intereses:</strong> {data.interests.length} · <strong>Habilidades:</strong> {data.skills.length}</p>
                <p><strong>Certificados externos:</strong> {data.externalCertificates.length}</p>
                <p><strong>Constancias internas:</strong> {data.internalConstancies.length}</p>
                <div className="mt">
                  <Link to="/student/profile" className="btn btn-secondary btn-sm">Editar perfil</Link>{' '}
                  <Link to="/student/projects" className="btn btn-secondary btn-sm">Mis proyectos</Link>
                </div>
              </Card>
            </div>
          </>
        )}
      </AsyncView>
    </div>
  );
}
