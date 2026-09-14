import ActivityManager from '../../components/ActivityManager';
import { PageHeader } from '../../components/ui';

export default function DirectorActivitiesPage() {
  return (
    <div>
      <PageHeader
        title="Actividades académicas"
        description="Publique y dé seguimiento a talleres, clases espejo, seminarios, charlas y cursos del programa. Desde aquí también se registra la asistencia y la participación de los estudiantes."
      />
      <ActivityManager activityType="academica" />
    </div>
  );
}
