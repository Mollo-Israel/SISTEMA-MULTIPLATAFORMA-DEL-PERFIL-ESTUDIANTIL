import ActivityManager from '../../components/ActivityManager';

export default function TeacherActivitiesPage() {
  return (
    <div>
      <h1>Actividades y participación</h1>
      <p className="muted">Publica actividades académicas y confirma la participación de los estudiantes.</p>
      <ActivityManager activityType="academica" />
    </div>
  );
}
