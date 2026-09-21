import ActivityManager from '../../components/ActivityManager';
import { PageHeader } from '../../components/ui';

/**
 * Gestión de actividades del docente (§22).
 *
 * El docente vuelve a publicar actividades académicas, pero acotadas a los
 * semestres que la administración le habilitó. No es una vuelta atrás respecto
 * del Objetivo 3: entonces se le quitó porque no había forma de delimitar su
 * alcance, y ahora la hay.
 *
 * Lo que publique queda dirigido a sus semestres, y solo alcanza a gestionar
 * actividades que caigan dentro de ellos. Las de toda la carrera siguen siendo
 * de la dirección, y las extracurriculares de la sociedad científica.
 */
export default function TeacherMyActivitiesPage() {
  return (
    <div>
      <PageHeader
        title="Mis actividades"
        description="Publique talleres, clases espejo y seminarios para sus semestres habilitados. Desde aquí también confirma la participación de quienes asistieron."
      />
      <div className="inline-note">
        Estas actividades quedan dirigidas a los semestres que tiene habilitados. Las
        actividades de toda la carrera las publica la dirección, y las extracurriculares
        la sociedad científica.
      </div>
      <ActivityManager activityType="academica" />
    </div>
  );
}
