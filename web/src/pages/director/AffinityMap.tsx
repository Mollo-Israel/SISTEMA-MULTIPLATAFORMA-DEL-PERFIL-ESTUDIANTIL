import { useAsync } from '../../hooks/useAsync';
import { reportService } from '../../services';
import { AsyncView, Card, Badge } from '../../components/ui';

export default function DirectorAffinityMap() {
  const map = useAsync(() => reportService.directorAffinityMap(), []);
  const projects = useAsync(() => reportService.directorProjects(), []);

  return (
    <div>
      <h1>Mapa básico de afinidad</h1>
      <p className="muted">Distribución agregada de afinidad por área académica.</p>

      <Card title="Áreas de afinidad (agregado)">
        <AsyncView loading={map.loading} error={map.error} data={map.data} isEmpty={(d: any) => d.length === 0} emptyMessage="Aún no hay afinidades calculadas.">
          {(rows: any) => (
            <table>
              <thead><tr><th>Área</th><th>Estudiantes</th><th>Promedio</th><th>Bajo</th><th>Medio</th><th>Alto</th></tr></thead>
              <tbody>
                {rows.map((a: any) => (
                  <tr key={a.areaId}>
                    <td>{a.area}</td><td>{a.students}</td><td>{a.averageScore}</td>
                    <td><Badge tone="gray">{a.byLevel.low}</Badge></td>
                    <td><Badge tone="amber">{a.byLevel.medium}</Badge></td>
                    <td><Badge tone="green">{a.byLevel.high}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>

      <Card title="Proyectos registrados">
        <AsyncView loading={projects.loading} error={projects.error} data={projects.data}>
          {(d: any) => (
            <>
              <p><strong>Total:</strong> {d.total}</p>
              <p><strong>Por estado:</strong> {d.byStatus.map((s: any) => `${s.status} (${s.count})`).join(', ') || '—'}</p>
              <p><strong>Por área:</strong> {d.byArea.map((a: any) => `${a.area} (${a.count})`).join(', ') || '—'}</p>
            </>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
