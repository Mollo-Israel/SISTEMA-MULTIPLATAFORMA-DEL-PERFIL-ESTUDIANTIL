import { useAsync } from '../../hooks/useAsync';
import { reportService } from '../../services';
import { AsyncView, Badge, Card, PageHeader, SkeletonTable } from '../../components/ui';

export default function TeacherReportsPage() {
  const affinity = useAsync(() => reportService.teacherAffinity(), []);
  const projects = useAsync(() => reportService.teacherProjects(), []);

  return (
    <div>
      <PageHeader
        title="Reportes del curso"
        description="Reportes descriptivos. No generan ranking de estudiantes ni evalúan rendimiento."
      />

      <Card title="Áreas de afinidad del grupo">
        <AsyncView
          loading={affinity.loading}
          error={affinity.error}
          data={affinity.data}
          skeleton={<SkeletonTable rows={4} columns={4} />}
        >
          {(d: any) => d.groupAffinity.length === 0 ? <p className="muted">Sin datos.</p> : (
            <table>
              <thead><tr><th>Área</th><th>Estudiantes</th><th>Promedio</th><th>Bajo/Medio/Alto</th></tr></thead>
              <tbody>
                {d.groupAffinity.map((a: any) => (
                  <tr key={a.areaId}>
                    <td>{a.area}</td><td>{a.students}</td><td>{a.averageScore}</td>
                    <td><Badge tone="gray">{a.byLevel.low}</Badge> <Badge tone="amber">{a.byLevel.medium}</Badge> <Badge tone="green">{a.byLevel.high}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>

      <Card title="Proyectos registrados">
        <AsyncView
          loading={projects.loading}
          error={projects.error}
          data={projects.data}
          skeleton={<SkeletonTable rows={3} columns={2} />}
        >
          {(d: any) => (
            <>
              <p><strong>Total:</strong> {d.total}</p>
              <p><strong>Por área:</strong> {d.byArea.map((a: any) => `${a.area} (${a.count})`).join(', ') || '—'}</p>
              <p><strong>Tecnologías:</strong> {d.topTechnologies.map((t: any) => `${t.technology} (${t.count})`).join(', ') || '—'}</p>
            </>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
