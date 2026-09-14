import ActivityManager from '../../components/ActivityManager';
import { PageHeader } from '../../components/ui';

export default function SocietyActivitiesPage() {
  return (
    <div>
      <PageHeader
        title="Actividades extracurriculares"
        description="Publica actividades extracurriculares, registra interesados y confirma la participación."
      />
      <ActivityManager activityType="extracurricular" />
    </div>
  );
}
