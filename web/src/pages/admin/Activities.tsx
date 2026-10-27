import ActivityTabs from '../../components/ActivityTabs';
import { PageHeader } from '../../components/ui';

/**
 * Oportunidades operativas de Administración (V3 §6.5, §54, V5 §5.1).
 *
 * Administración puede crear y publicar de forma excepcional, sin revisión,
 * pero siempre nombra a un responsable académico real: no se convierte en
 * emisor académico por estar por encima técnicamente.
 */
export default function AdminActivitiesPage() {
  return (
    <div>
      <PageHeader
        title="Oportunidades"
        description="Creación excepcional u operativa de actividades internas y oportunidades externas. Cada una lleva su responsable académico, que es quien admite a los estudiantes y registra la asistencia."
      />
      <ActivityTabs vistas={['academica', 'extracurricular', 'externa']} />
    </div>
  );
}
