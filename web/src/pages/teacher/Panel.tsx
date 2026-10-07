import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { useAsync } from '../../hooks/useAsync';
import { reportService } from '../../services';
import { CountBars } from '../../components/charts';
import { AsyncView, Card, PageHeader, PanelEmbebido, SkeletonCards, Tabs } from '../../components/ui';
import TeacherReportsPage from './Reports';
import TeacherStudentsPage from './Students';
import TeacherStudentProjectsPage from './StudentProjects';
import TeacherActivitiesPage from './Activities';
import TeacherTeamNeedsPage from './TeamNeeds';

const PESTANAS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'semestre', label: 'Por semestre' },
  { key: 'estudiantes', label: 'Estudiantes' },
  { key: 'proyectos', label: 'Proyectos visibles' },
  { key: 'actividades', label: 'Actividades' },
  { key: 'equipos', label: 'Necesidades/equipos' },
] as const;
type Pestana = (typeof PESTANAS)[number]['key'];

/**
 * Inicio / Panel académico del docente (V3 §51).
 *
 * Antes había un «Panel» y un «Panel académico» que resumían casi lo mismo, y
 * cinco entradas de menú más para mirar a los mismos estudiantes desde otro
 * ángulo. Ahora es una sola pantalla con pestañas: el resumen lleva con un clic
 * al detalle (drill-down), y la pestaña viaja en la URL.
 */
export default function TeacherPanel() {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('tab') as Pestana | null;
  const tab: Pestana = PESTANAS.some((p) => p.key === pedida) ? (pedida as Pestana) : 'resumen';
  const ir = (k: string, extra: Record<string, string> = {}) =>
    setParams(k === 'resumen' ? extra : { tab: k, ...extra }, { replace: true });

  return (
    <div>
      <PageHeader
        title="Panel académico"
        description="Los estudiantes de tus semestres habilitados: resumen, detalle y lo que necesitan. Descriptivo; no es ranking ni evaluación."
      />
      <Tabs value={tab} onChange={(k) => ir(k)} items={PESTANAS.map((p) => ({ key: p.key, label: p.label }))} />
      <PanelEmbebido.Provider value>
        {tab === 'resumen' && <Resumen ir={ir} />}
        {tab === 'semestre' && <TeacherReportsPage onSemester={(s) => ir('estudiantes', { semestre: String(s) })} />}
        {tab === 'estudiantes' && <TeacherStudentsPage />}
        {tab === 'proyectos' && <TeacherStudentProjectsPage />}
        {tab === 'actividades' && <TeacherActivitiesPage />}
        {tab === 'equipos' && <TeacherTeamNeedsPage />}
      </PanelEmbebido.Provider>
    </div>
  );
}

/** Tarjetas que llevan al detalle: el resumen no es un callejón sin salida. */
function Resumen({ ir }: { ir: (k: string, extra?: Record<string, string>) => void }) {
  const { data, loading, error } = useAsync(() => reportService.teacherOverview(), []);
  return (
    <AsyncView loading={loading} error={error} data={data} skeleton={<SkeletonCards count={4} />}>
      {(d: any) => (
        <>
          <div className="grid cols-4">
            <Tarjeta valor={d.students.total} etiqueta="Estudiantes" accion="Ver estudiantes" onClick={() => ir('estudiantes')} />
            <Tarjeta valor={d.incompleteStudents.count} etiqueta="Perfiles incompletos" accion="Ver por semestre" onClick={() => ir('semestre')} />
            <Tarjeta valor={d.participation.total} etiqueta="Participaciones" accion="Ver actividades" onClick={() => ir('actividades')} />
            <Tarjeta valor={d.participation.byStatus.confirmed} etiqueta="Confirmadas" accion="Ver actividades" onClick={() => ir('actividades')} />
          </div>
          <div className="grid cols-2 mt">
            <Card title="Intereses predominantes">
              <CountBars data={d.topInterests.map((i: any) => ({ label: i.area, value: i.count }))} />
            </Card>
            <Card title="Tecnologías más usadas" actions={<Link to="/teacher?tab=proyectos" className="btn btn-ghost btn-sm">Ver proyectos</Link>}>
              <CountBars data={d.topTechnologies.map((t: any) => ({ label: t.technology, value: t.count }))} />
            </Card>
          </div>
        </>
      )}
    </AsyncView>
  );
}

function Tarjeta({ valor, etiqueta, accion, onClick }: { valor: number; etiqueta: string; accion: string; onClick: () => void }) {
  return (
    <button type="button" className="card stat stat-link" onClick={onClick}>
      <span className="value">{valor}</span>
      <span className="label">{etiqueta}</span>
      <span className="stat-accion">{accion} <FiArrowRight size={12} /></span>
    </button>
  );
}
