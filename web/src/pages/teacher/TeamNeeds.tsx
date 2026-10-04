import { useAsync } from '../../hooks/useAsync';
import { reportService, type TeacherTeamNeed } from '../../services';
import { AsyncView, Badge, Card, PageHeader, SkeletonCards } from '../../components/ui';

const FECHA = (v: string) =>
  new Date(v).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Necesidades de equipo de los estudiantes de tus semestres (V2 §62, §77).
 * Solo lectura: sirven para orientar —sugerir una actividad, conectar a dos
 * grupos—, no para elegir integrantes, que es decisión de los estudiantes.
 */
export default function TeacherTeamNeedsPage() {
  const state = useAsync(() => reportService.teacherTeamNeeds(), []);
  return (
    <div>
      <PageHeader
        title="Necesidades de equipo"
        description="Lo que buscan los equipos que se están formando en tus semestres. No puedes invitar desde aquí: formar el equipo es decisión de los estudiantes."
      />
      <AsyncView
        loading={state.loading}
        error={state.error}
        data={state.data}
        skeleton={<SkeletonCards count={3} />}
        isEmpty={(d: TeacherTeamNeed[]) => d.length === 0}
        emptyMessage="No hay necesidades de equipo abiertas en tus semestres."
      >
        {(lista: TeacherTeamNeed[]) => (
          <>
            {lista.map((n) => (
              <Card key={n.id} title={n.purpose} actions={<Badge tone="bordo">{n.semester}.º semestre</Badge>}>
                <p className="muted small" style={{ marginTop: 0 }}>
                  Responsable: {n.owner} · publicada el {FECHA(n.createdAt)}
                  {n.maxMembers ? ` · hasta ${n.maxMembers} integrantes` : ''}
                </p>
                {n.description && <p>{n.description}</p>}
                {n.requiredSkills.length > 0 && (
                  <div className="chip-row">
                    {n.requiredSkills.map((s) => <span key={s} className="chip">{s}</span>)}
                  </div>
                )}
                {n.preferredAreas.length > 0 && (
                  <p className="muted small">Áreas preferidas: {n.preferredAreas.join(', ')}</p>
                )}
              </Card>
            ))}
          </>
        )}
      </AsyncView>
    </div>
  );
}
