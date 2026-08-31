import ActivityManager from '../../components/ActivityManager';

export default function DirectorActivitiesPage() {
  return (
    <div>
      <h1>Actividades académicas</h1>
      <p className="muted">
        Publique y dé seguimiento a talleres, clases espejo, seminarios, charlas, cursos y demás
        actividades académicas complementarias del programa. Desde aquí también se registra la
        asistencia y participación de los estudiantes.
      </p>
      <ActivityManager activityType="academica" />
    </div>
  );
}
