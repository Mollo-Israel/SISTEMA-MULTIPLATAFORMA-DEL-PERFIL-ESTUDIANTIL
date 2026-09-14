import { Link } from 'react-router-dom';
import { FiCalendar, FiCheckCircle, FiUsers } from 'react-icons/fi';
import { Card, PageHeader, Stagger } from '../../components/ui';

const PASOS = [
  {
    icon: <FiCalendar />,
    title: 'Publica la actividad',
    text: 'Crea la actividad con fecha, modalidad y cupo. En borrador nadie la ve todavía.',
  },
  {
    icon: <FiUsers />,
    title: 'Revisa quién se apunta',
    text: 'Verás a los interesados y a los inscritos en la pestaña de participación.',
  },
  {
    icon: <FiCheckCircle />,
    title: 'Confirma la participación',
    text: 'Solo la participación confirmada suma al perfil del estudiante.',
  },
];

export default function SocietyDashboard() {
  return (
    <div>
      <PageHeader
        title="Sociedad científica"
        description="Desde aquí publicas actividades extracurriculares y confirmas la participación de los estudiantes."
        actions={
          <Link to="/society/activities" className="btn btn-primary">
            Gestionar actividades
          </Link>
        }
      />

      <div className="qa-grid">
        {PASOS.map((paso, index) => (
          <Stagger key={paso.title} index={index}>
            <Card title={paso.title}>
              <div className="flex" style={{ gap: '0.6rem', alignItems: 'flex-start' }}>
                <span className="qi">{paso.icon}</span>
                <p className="muted" style={{ margin: 0 }}>{paso.text}</p>
              </div>
            </Card>
          </Stagger>
        ))}
      </div>
    </div>
  );
}
