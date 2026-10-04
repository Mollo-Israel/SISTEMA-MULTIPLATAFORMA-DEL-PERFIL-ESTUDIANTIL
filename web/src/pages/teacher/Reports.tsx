import { useAsync } from '../../hooks/useAsync';
import { reportService } from '../../services';
import { AsyncView, Badge, Card, PageHeader, SkeletonTable } from '../../components/ui';

/**
 * Panel académico del docente (V2 §62). Antes se llamaba «Reportes del curso»,
 * pero Afinia no tiene datos de una asignatura oficial: describe a los
 * estudiantes de los semestres habilitados para el docente, agrupados por
 * semestre.
 */
export default function TeacherReportsPage() {
  const overview = useAsync(() => reportService.teacherOverview(), []);
  const affinity = useAsync(() => reportService.teacherAffinity(), []);
  const projects = useAsync(() => reportService.teacherProjects(), []);

  return (
    <div>
      <PageHeader
        title="Panel académico"
        description="Resumen descriptivo de los estudiantes de tus semestres habilitados. No es el registro de una asignatura, no genera ranking de estudiantes ni evalúa rendimiento."
      />

      <Card title="Resumen por semestre">
        <AsyncView
          loading={overview.loading}
          error={overview.error}
          data={overview.data}
          skeleton={<SkeletonTable rows={3} columns={6} />}
        >
          {(d: any) => (d.bySemester ?? []).length === 0 ? (
            <p className="muted">{d.group?.description ?? 'Sin datos.'}</p>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Semestre</th><th>Estudiantes</th><th>Perfiles activos</th>
                    <th>Participaciones confirmadas</th><th>Proyectos abiertos a docentes</th><th>Necesidades de equipo</th>
                  </tr>
                </thead>
                <tbody>
                  {d.bySemester.map((f: any) => (
                    <tr key={f.semester}>
                      <td>{f.semester}.º</td><td>{f.students}</td><td>{f.activeProfiles}</td>
                      <td>{f.confirmedParticipations}</td><td>{f.projectsVisibleToTeachers}</td><td>{f.openTeamNeeds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>

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
