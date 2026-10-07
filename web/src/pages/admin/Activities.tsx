import { useSearchParams } from 'react-router-dom';
import ActivityManager from '../../components/ActivityManager';
import { PageHeader, Tabs } from '../../components/ui';

/**
 * Oportunidades operativas de Administración (V3 §6.5, §54).
 *
 * Administración puede crear y publicar de forma excepcional, sin revisión,
 * pero siempre nombra a un responsable académico real: no se convierte en
 * emisor académico por estar por encima técnicamente.
 */
export default function AdminActivitiesPage() {
  const [params, setParams] = useSearchParams();
  const tipo = params.get('tipo') === 'extracurricular' ? 'extracurricular' : 'academica';
  return (
    <div>
      <PageHeader
        title="Oportunidades"
        description="Creación excepcional u operativa de oportunidades internas o externas. Cada una lleva su responsable académico, que es quien confirma la participación."
      />
      <Tabs
        items={[
          { key: 'academica', label: 'Académicas' },
          { key: 'extracurricular', label: 'Extracurriculares' },
        ]}
        value={tipo}
        onChange={(k) => setParams(k === 'academica' ? {} : { tipo: k }, { replace: true })}
      />
      <ActivityManager key={tipo} activityType={tipo} />
    </div>
  );
}
