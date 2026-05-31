import ActivityManager from '../../components/ActivityManager';

export default function SocietyActivitiesPage() {
  return (
    <div>
      <h1>Actividades extracurriculares</h1>
      <p className="muted">Publica actividades extracurriculares, registra interesados y confirma participación.</p>
      <ActivityManager activityType="extracurricular" />
    </div>
  );
}
