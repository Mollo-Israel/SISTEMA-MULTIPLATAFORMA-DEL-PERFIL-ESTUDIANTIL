import { Link } from 'react-router-dom';
import { Card } from '../../components/ui';

export default function SocietyDashboard() {
  return (
    <div>
      <h1>Sociedad científica</h1>
      <Card title="Bienvenida">
        <p>Desde aquí publicas actividades extracurriculares y confirmas la participación de los estudiantes.</p>
        <Link to="/society/activities" className="btn btn-primary mt">Gestionar actividades</Link>
      </Card>
    </div>
  );
}
