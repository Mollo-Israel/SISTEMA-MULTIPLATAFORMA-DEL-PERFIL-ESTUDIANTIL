import { useAsync } from '../../hooks/useAsync';
import { reportService } from '../../services';
import { AsyncView, Card, Stat } from '../../components/ui';

export default function DirectorDashboard() {
  const overview = useAsync(() => reportService.directorOverview(), []);
  const semester = useAsync(() => reportService.participationBySemester(), []);

  return (
    <div>
      <h1>Panel de dirección</h1>
      <p className="muted">Indicadores descriptivos de la carrera. No representan rendimiento ni predicción.</p>

      <AsyncView loading={overview.loading} error={overview.error} data={overview.data}>
        {(d: any) => (
          <>
            <div className="grid cols-4">
              <Stat value={d.totals.students} label="Estudiantes" />
              <Stat value={d.totals.projects} label="Proyectos" />
              <Stat value={d.totals.activities} label="Actividades" />
              <Stat value={d.totals.registrations} label="Participaciones" />
            </div>
            <div className="grid cols-2 mt">
              <Card title="Áreas con mayor interés">
                <table><tbody>{d.topInterestAreas.map((a: any) => <tr key={a.area}><td>{a.area}</td><td style={{ width: 60 }}>{a.count}</td></tr>)}</tbody></table>
                {d.topInterestAreas.length === 0 && <p className="muted">Sin datos.</p>}
              </Card>
              <Card title="Distribución de habilidades">
                <table><tbody>{d.skillDistribution.map((s: any) => <tr key={s.skill}><td>{s.skill}</td><td className="muted">{s.area ?? '—'}</td><td style={{ width: 60 }}>{s.count}</td></tr>)}</tbody></table>
                {d.skillDistribution.length === 0 && <p className="muted">Sin datos.</p>}
              </Card>
            </div>
            <Card title="Tendencias descriptivas">
              <p><strong>Completitud promedio de perfiles:</strong> {d.trends.averageProfileCompletion}%</p>
              <p><strong>Perfiles completos:</strong> {d.trends.profilesComplete} ({d.trends.profilesCompletePercentage}%)</p>
              <p className="muted">{d.trends.note}</p>
            </Card>
          </>
        )}
      </AsyncView>

      <Card title="Participación por semestre">
        <AsyncView loading={semester.loading} error={semester.error} data={semester.data} isEmpty={(d: any) => d.length === 0} emptyMessage="Sin participaciones registradas.">
          {(rows: any) => (
            <table>
              <thead><tr><th>Semestre</th><th>Total</th><th>Interés</th><th>Inscritos</th><th>Confirmados</th><th>Ausentes</th></tr></thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.semester ?? 'Sin semestre'}</td><td>{r.total}</td>
                    <td>{r.byStatus.interested}</td><td>{r.byStatus.registered}</td>
                    <td>{r.byStatus.confirmed}</td><td>{r.byStatus.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
