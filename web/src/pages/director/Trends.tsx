import { FiEyeOff, FiInfo } from 'react-icons/fi';
import { analyticsService, type DirectorTrends } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import AiAssist from '../../components/AiAssist';
import {
  AsyncView, Badge, Card, EmptyState, PageHeader, SkeletonCards,
} from '../../components/ui';

/** Una fila que el umbral de §65 dejó sin desglosar. */
export const suprimida = (f: { suppressed?: boolean }) => f.suppressed === true;

/**
 * Tendencias de la carrera (§64).
 *
 * Todas describen lo que ocurrió. §64 prohíbe predecir notas, abandono,
 * aprobación, éxito profesional o rendimiento, y esta pantalla no muestra
 * ninguna proyección: solo cuánto hay de cada cosa y cómo cambió.
 *
 * Donde el grupo es demasiado pequeño aparece el motivo en vez del dato. Es el
 * umbral de §65 y se muestra a propósito: un hueco sin explicar parece un error
 * del sistema, y esto es una decisión.
 */
export default function DirectorTrendsPage() {
  const state = useAsync(() => analyticsService.directorTrends(), []);

  return (
    <div>
      <PageHeader
        title="Tendencias de la carrera"
        description="Qué áreas se declaran, cómo evoluciona la participación y qué tecnologías aparecen en los proyectos."
      />

      <AsyncView
        loading={state.loading}
        error={state.error}
        data={state.data}
        skeleton={<SkeletonCards count={3} />}
      >
        {(t: DirectorTrends) => (
          <>
            <div className="scope-note">
              <FiInfo size={16} />
              <span>{t.note.scope}</span>
            </div>

            {/* V2 §63: la IA redacta sobre estas cifras; no calcula ni inventa. */}
            <AiAssist
              task="ANALYTICS_NARRATIVE"
              label="Lectura narrativa"
              request={() => ({})}
              render={(r) => <p style={{ margin: 0 }}>{r.narrative}</p>}
            />

            <Card title="Interés declarado por área">
              <p className="muted" style={{ marginTop: 0 }}>
                Cuántos estudiantes declaran cada área, y cuántos lo hicieron en los últimos
                noventa días.
              </p>
              <Tabla
                filas={t.interestByArea}
                columnas={[
                  { clave: 'area', titulo: 'Área' },
                  { clave: 'students', titulo: 'Estudiantes', numerica: true },
                  { clave: 'declaredLast90Days', titulo: 'Últimos 90 días', numerica: true },
                  { clave: 'averagePriority', titulo: 'Prioridad media', numerica: true },
                ]}
                vacio="Todavía no hay intereses declarados."
              />
            </Card>

            <Card title="Participación por mes">
              <Tabla
                filas={t.participation}
                columnas={[
                  { clave: 'period', titulo: 'Mes' },
                  { clave: 'students', titulo: 'Estudiantes', numerica: true },
                  { clave: 'registrations', titulo: 'Inscripciones', numerica: true },
                  { clave: 'confirmed', titulo: 'Confirmadas', numerica: true },
                ]}
                vacio="Todavía no hay participación registrada."
              />
            </Card>

            <Card title="Áreas predominantes por semestre">
              {t.areasBySemester.length === 0 && (
                <EmptyState message="Todavía no hay afinidades calculadas." />
              )}
              {t.areasBySemester.map((s) => (
                <div key={s.semester} className="necesidad">
                  <div className="flex between">
                    <strong>{s.semester}.º semestre</strong>
                    <Badge tone="gray">{s.students} estudiantes</Badge>
                  </div>
                  {suprimida(s) ? (
                    <p className="muted sin-desglose">
                      <FiEyeOff size={13} /> {s.reason}
                    </p>
                  ) : (
                    <div className="chip-row">
                      {(s.areas ?? []).map((a) => (
                        <span key={a.area} className="chip">
                          {a.area} · {a.students} · afinidad {a.averageAffinity} · respaldo{' '}
                          {a.averageSupport}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Card>

            <Card title="Tecnologías en los proyectos">
              <Tabla
                filas={t.technologies}
                columnas={[
                  { clave: 'technology', titulo: 'Tecnología' },
                  { clave: 'projects', titulo: 'Proyectos', numerica: true },
                  { clave: 'students', titulo: 'Estudiantes', numerica: true },
                ]}
                vacio="Todavía no hay proyectos con tecnologías declaradas."
              />
            </Card>

            <Card title="Actividades con mayor participación">
              <Tabla
                filas={t.activities}
                columnas={[
                  { clave: 'activity', titulo: 'Actividad' },
                  { clave: 'area', titulo: 'Área' },
                  { clave: 'registrations', titulo: 'Inscripciones', numerica: true },
                  { clave: 'confirmed', titulo: 'Confirmadas', numerica: true },
                ]}
                vacio="Todavía no hay actividades con inscripciones."
              />
            </Card>

            <Card title="Recursos más consultados">
              <Tabla
                filas={t.resources ?? []}
                columnas={[
                  { clave: 'title', titulo: 'Recurso' },
                  { clave: 'opened', titulo: 'Estudiantes que lo abrieron', numerica: true },
                  { clave: 'saved', titulo: 'Lo guardaron', numerica: true },
                ]}
                vacio="Todavía nadie abrió un recurso recomendado."
              />
            </Card>
          </>
        )}
      </AsyncView>
    </div>
  );
}

interface Columna {
  clave: string;
  titulo: string;
  numerica?: boolean;
}

/**
 * Tabla que sabe mostrar una fila suprimida.
 *
 * Se comparte entre los cinco bloques porque el tratamiento del umbral tiene
 * que ser idéntico en todos: si cada tabla lo resolviera a su manera, en alguna
 * acabaría viéndose un cero donde en realidad hay un dato que no se publica.
 */
export function Tabla({
  filas,
  columnas,
  vacio,
}: {
  filas: Record<string, unknown>[];
  columnas: Columna[];
  vacio: string;
}) {
  if (filas.length === 0) return <EmptyState message={vacio} />;

  return (
    <div className="scroll-x">
      <table>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} style={c.numerica ? { textAlign: 'right' } : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={`${String(f[columnas[0].clave])}-${i}`}>
              {columnas.map((c, j) => {
                if (suprimida(f) && f[c.clave] === undefined) {
                  // Una sola celda explica la supresión, y ocupa lo que queda.
                  return j === columnas.findIndex((x) => f[x.clave] === undefined) ? (
                    <td key={c.clave} colSpan={columnas.length - j} className="muted sin-desglose">
                      <FiEyeOff size={12} /> {String(f.reason ?? '')}
                    </td>
                  ) : null;
                }
                return (
                  <td key={c.clave} style={c.numerica ? { textAlign: 'right' } : c.clave === 'period' ? { whiteSpace: 'nowrap' } : undefined}>
                    {f[c.clave] === null || f[c.clave] === undefined ? '—' : String(f[c.clave])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
