import { useAsync } from '../../hooks/useAsync';
import { reportService } from '../../services';
import { AsyncView, Stat, Card } from '../../components/ui';

export default function TeacherDashboard() {
  const { data, loading, error } = useAsync(() => reportService.teacherOverview(), []);
  return (
    <div>
      <h1>Panel docente</h1>
      <AsyncView loading={loading} error={error} data={data}>
        {(d: any) => (
          <>
            <div className="grid cols-4">
              <Stat value={d.students.total} label="Estudiantes" />
              <Stat value={d.incompleteStudents.count} label="Perfiles incompletos" />
              <Stat value={d.participation.total} label="Participaciones" />
              <Stat value={d.participation.byStatus.confirmed} label="Confirmadas" />
            </div>
            <div className="grid cols-2 mt">
              <Card title="Intereses predominantes">
                <table><tbody>{d.topInterests.map((i: any) => <tr key={i.area}><td>{i.area}</td><td style={{ width: 60 }}>{i.count}</td></tr>)}</tbody></table>
                {d.topInterests.length === 0 && <p className="muted">Sin datos.</p>}
              </Card>
              <Card title="Tecnologías más usadas">
                <table><tbody>{d.topTechnologies.map((t: any) => <tr key={t.technology}><td>{t.technology}</td><td style={{ width: 60 }}>{t.count}</td></tr>)}</tbody></table>
                {d.topTechnologies.length === 0 && <p className="muted">Sin datos.</p>}
              </Card>
            </div>
          </>
        )}
      </AsyncView>
    </div>
  );
}
