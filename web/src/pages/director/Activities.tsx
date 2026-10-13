import { useSearchParams } from 'react-router-dom';
import ActivityManager from '../../components/ActivityManager';
import { PageHeader, Tabs } from '../../components/ui';

type Vista = 'academica' | 'extracurricular' | 'externa';

/**
 * Actividades de la carrera para Dirección (V3.2 §26).
 *
 * Tres vistas: las académicas (que crea y publica sin aprobarse a sí misma),
 * las extracurriculares que aprobó a la Sociedad (seguimiento y ajustes, no las
 * crea) y las externas de cualquier tipo. Lo que Dirección aprueba deja la
 * bandeja de Pendientes y aparece aquí, con su creador y sus responsables.
 */
export default function DirectorActivitiesPage() {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('vista');
  const vista: Vista = pedida === 'extracurricular' || pedida === 'externa' ? pedida : 'academica';
  return (
    <div>
      <PageHeader
        title="Actividades de la carrera"
        description="Publique y dé seguimiento a las actividades académicas, a las extracurriculares aprobadas y a las oportunidades externas. Desde aquí también se registra la participación."
      />
      <Tabs
        items={[
          { key: 'academica', label: 'Académicas' },
          { key: 'extracurricular', label: 'Extracurriculares' },
          { key: 'externa', label: 'Externas' },
        ]}
        value={vista}
        onChange={(k) => setParams(k === 'academica' ? {} : { vista: k }, { replace: true })}
      />
      {vista === 'academica' && <ActivityManager key="academica" activityType="academica" filtroOrigen="internal" />}
      {vista === 'extracurricular' && (
        <ActivityManager key="extracurricular" activityType="extracurricular" puedeCrear={false} />
      )}
      {vista === 'externa' && <ActivityManager key="externa" activityType="academica" filtroOrigen="external" />}
    </div>
  );
}
