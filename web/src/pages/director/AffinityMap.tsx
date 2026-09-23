import { useAsync } from '../../hooks/useAsync';
import { analyticsService, reportService } from '../../services';
import { AsyncView, Badge, Card, PageHeader, SkeletonCards, SkeletonTable } from '../../components/ui';
import { LevelStackBars } from '../../components/charts';

/**
 * Mapa de áreas de la carrera (§69).
 *
 * Esta pantalla leía la versión sin umbral de privacidad: mostraba el desglose
 * de cualquier área, aunque la formaran dos estudiantes. Ahora lee la única
 * ruta que queda, que aplica §65 y marca las filas que no puede desglosar.
 *
 * Las columnas son de **respaldo**, no de afinidad: junto al promedio de
 * afinidad dicen cuánto de eso está demostrado, que es la pregunta que sirve
 * para decidir dónde hace falta apoyo.
 */
export default function DirectorAffinityMap() {
  const map = useAsync(() => analyticsService.directorAffinityMap(), []);
  const projects = useAsync(() => reportService.directorProjects(), []);

  return (
    <div>
      <PageHeader
        title="Mapa de afinidad y respaldo"
        description="Distribución agregada por área académica. Es una lectura del conjunto, no una evaluación de personas."
      />

      <Card title="Áreas de afinidad (agregado)">
        <AsyncView
          loading={map.loading}
          error={map.error}
          data={map.data}
          skeleton={<SkeletonCards count={2} />}
          isEmpty={(d: any) => !d?.areas?.length}
          emptyMessage="Aún no hay afinidades calculadas."
        >
          {(d: any) => {
            const desglosables = d.areas.filter((a: any) => !a.suppressed);
            const reservadas = d.areas.filter((a: any) => a.suppressed);
            return (
              <>
                {desglosables.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <LevelStackBars
                      data={desglosables.map((a: any) => ({
                        area: a.area,
                        low: a.bySupportLevel.bajo,
                        medium: a.bySupportLevel.medio,
                        high: a.bySupportLevel.alto,
                      }))}
                    />
                  </div>
                )}
                <table>
                  <thead>
                    <tr>
                      <th>Área</th>
                      <th>Estudiantes</th>
                      <th>Afinidad media</th>
                      <th>Respaldo medio</th>
                      <th>Respaldo bajo</th>
                      <th>Respaldo medio</th>
                      <th>Respaldo alto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.areas.map((a: any) =>
                      a.suppressed ? (
                        <tr key={a.area}>
                          <td>{a.area}</td>
                          <td>{a.students}</td>
                          <td colSpan={5} className="muted">
                            {a.reason}
                          </td>
                        </tr>
                      ) : (
                        <tr key={a.area}>
                          <td>{a.area}</td>
                          <td>{a.students}</td>
                          <td>{a.averageAffinity}</td>
                          <td>{a.averageSupport}</td>
                          <td><Badge tone="gray">{a.bySupportLevel.bajo}</Badge></td>
                          <td><Badge tone="amber">{a.bySupportLevel.medio}</Badge></td>
                          <td><Badge tone="green">{a.bySupportLevel.alto}</Badge></td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
                {reservadas.length > 0 && <p className="muted">{d.note.privacy}</p>}
                <p className="muted">{d.note.scope}</p>
              </>
            );
          }}
        </AsyncView>
      </Card>

      <Card title="Proyectos registrados">
        <AsyncView
          loading={projects.loading}
          error={projects.error}
          data={projects.data}
          skeleton={<SkeletonTable rows={3} columns={2} />}
        >
          {(d: any) => (
            <>
              <p><strong>Total:</strong> {d.total}</p>
              <p><strong>Por estado:</strong> {d.byStatus.map((s: any) => `${s.status} (${s.count})`).join(', ') || '—'}</p>
              <p><strong>Por área:</strong> {d.byArea.map((a: any) => `${a.area} (${a.count})`).join(', ') || '—'}</p>
            </>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
