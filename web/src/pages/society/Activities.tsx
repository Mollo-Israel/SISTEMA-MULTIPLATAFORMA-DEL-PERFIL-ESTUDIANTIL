import ActivityTabs from '../../components/ActivityTabs';
import { PageHeader } from '../../components/ui';

/** V5 §5.3: la Sociedad crea extracurriculares y oportunidades externas complementarias. */
export default function SocietyActivitiesPage() {
  return (
    <div>
      <PageHeader
        title="Actividades extracurriculares"
        description="Publica actividades extracurriculares y oportunidades externas, admite a quienes piden un lugar y registra la asistencia."
      />
      <ActivityTabs vistas={['extracurricular', 'externa']} tipoDeExternas="extracurricular" />
    </div>
  );
}
