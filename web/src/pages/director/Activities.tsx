import ActivityTabs from '../../components/ActivityTabs';
import { PageHeader } from '../../components/ui';

/**
 * Actividades de la carrera para Dirección (V3.2 §26, V5 §5.1).
 *
 * Tres pestañas: las académicas (que crea y publica sin aprobarse a sí misma),
 * las extracurriculares que aprobó a la Sociedad (seguimiento y ajustes, no las
 * crea) y las externas de cualquier tipo. Lo que Dirección aprueba deja la
 * bandeja de Pendientes y aparece aquí, con su creador y sus responsables.
 */
export default function DirectorActivitiesPage() {
  return (
    <div>
      <PageHeader
        title="Actividades de la carrera"
        description="Publique y dé seguimiento a las actividades académicas, a las extracurriculares aprobadas y a las oportunidades externas. Desde aquí también se admite a quienes piden un lugar y se registra la asistencia."
      />
      <ActivityTabs vistas={['academica', 'extracurricular', 'externa']} soloSeguimiento={['extracurricular']} />
    </div>
  );
}
