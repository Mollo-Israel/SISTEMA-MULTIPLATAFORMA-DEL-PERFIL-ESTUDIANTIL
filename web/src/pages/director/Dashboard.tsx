import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAward, FiBarChart2, FiBookOpen, FiCalendar, FiCheckSquare, FiFolder, FiShield, FiStar, FiUnlock, FiUsers,
} from 'react-icons/fi';
import { useAsync } from '../../hooks/useAsync';
import { reportService, type InicioRol } from '../../services';
import { AsyncView, Card, SkeletonCards } from '../../components/ui';
import { SaludoRol } from '../../components/InicioRol';
import { DetallesInicio, TarjetaInicio, type ConfigTarjeta, type SegmentoDetalle } from '../../components/DetallesInicio';

/**
 * V7.1 §13 · Inicio de Dirección: el mismo patrón que Administración (§3.1).
 *
 * Cada tarjeta muestra su total real y «Detalles», un modal de solo lectura
 * con los últimos 10 del conjunto y «Ir a…», que lleva al módulo de Dirección
 * con el filtro ya aplicado. Aprobar, decidir una credencial o conceder
 * autonomía se hace en su módulo, nunca desde aquí. Los datos salen de las
 * rutas de Dirección (`/reports/director/home…`): reutilizar el componente no
 * da a nadie permisos de otro rol.
 */

const n = (v: unknown) => Number(v ?? 0);
const plural = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;

const APROBACION = (tipo: 'academica' | 'extracurricular' | 'externa', label: string, vacio: string): SegmentoDetalle => ({
  key: tipo, label, destino: `/director/approvals?tipo=${tipo}`, destinoLabel: 'Ir a Aprobaciones', vacio,
});
const actividad = (vista: string) => (f: { actividadId?: string }) =>
  f.actividadId ? `/director/activities?vista=${vista}&actividad=${f.actividadId}` : null;
const VISTA = (vista: 'academica' | 'extracurricular' | 'externa', label: string, vacio: string): SegmentoDetalle => ({
  key: vista, label, destino: `/director/activities?vista=${vista}`, destinoLabel: 'Ir a Actividades', vacio,
  destinoFila: actividad(vista), destinoFilaLabel: 'Ver participantes',
});
const participacion = (f: { actividadId?: string }) => (f.actividadId ? `/director/constancies?actividad=${f.actividadId}` : null);

const TARJETAS: Record<string, ConfigTarjeta> = {
  aprobaciones: {
    titulo: 'Actividades por aprobar', icono: <FiCheckSquare />, tono: 3, que: 'esperan tu decisión',
    extra: (r) => [
      `${n(r.academica)} académicas · ${n(r.extracurricular)} extracurriculares · ${n(r.externa)} externas`,
      n(r.observadas) ? `${plural(n(r.observadas), 'observada espera', 'observadas esperan')} correcciones` : null,
    ].filter(Boolean).join(' · '),
    resumen: 'Propuestas de docentes y de la sociedad científica que esperan tu decisión, con quién las propone y cuándo.',
    segmentos: [
      APROBACION('academica', 'Académicas', 'Ninguna académica espera decisión.'),
      APROBACION('extracurricular', 'Extracurriculares', 'Ninguna extracurricular espera decisión.'),
      APROBACION('externa', 'Externas', 'Ninguna oportunidad externa espera decisión.'),
    ],
  },
  credenciales: {
    titulo: 'Credenciales en revisión', icono: <FiShield />, tono: 1, que: 'pendientes de decisión',
    extra: (r) => (n(r.observadas) ? `${plural(n(r.observadas), 'observada espera', 'observadas esperan')} corrección del estudiante` : 'Todas pasan por tu revisión'),
    resumen: 'Credenciales externas que esperan tu decisión: todas, no solo los casos especiales. Lo ya decidido está en su propia vista.',
    segmentos: [
      { key: 'pendientes', label: 'Pendientes', destino: '/director/credential-reviews', destinoLabel: 'Ir a revisión de credenciales', vacio: 'Ninguna credencial espera decisión.' },
      { key: 'observadas', label: 'Observadas', destino: '/director/credential-reviews?estado=observadas', destinoLabel: 'Ir a las observadas', vacio: 'Ninguna observada.' },
      { key: 'decididas', label: 'Decididas', destino: '/director/credential-reviews?estado=decididas', destinoLabel: 'Ir a las decididas', vacio: 'Todavía no hay decisiones.' },
    ],
  },
  estudiantes: {
    titulo: 'Estudiantes', icono: <FiUsers />, tono: 4, que: 'con perfil en Afinia',
    extra: (r) => `${n(r.activas)} con la cuenta activa`,
    resumen: 'Cuántos estudiantes hay por semestre y las últimas altas. Sin correos ni códigos: el detalle por semestre está en Analítica.',
    segmentos: [
      { key: 'semestres', label: 'Por semestre', destino: '/director/analytics?tab=participacion', destinoLabel: 'Ir a participación por semestre', vacio: 'Todavía no hay estudiantes.' },
      { key: 'recientes', label: 'Altas recientes', destino: '/director/analytics?tab=participacion', destinoLabel: 'Ir a participación por semestre', vacio: 'Todavía no hay estudiantes.' },
    ],
  },
  proyectos: {
    titulo: 'Proyectos de la carrera', icono: <FiFolder />, tono: 1, que: 'activos y compartidos',
    resumen: 'Los proyectos activos que sus responsables compartieron con la carrera. Nunca borradores ni privados, y sin evidencias.',
    segmentos: [{ key: 'recientes', label: 'Recientes', destino: '/proyectos', destinoLabel: 'Ir a proyectos de la carrera', vacio: 'Todavía no hay proyectos compartidos.' }],
  },
  actividades: {
    titulo: 'Actividades', icono: <FiCalendar />, tono: 0, que: 'en tu gestión',
    extra: (r) => `${n(r.academica)} académicas · ${n(r.extracurricular)} extracurriculares · ${n(r.externa)} externas`,
    resumen: 'Las actividades que gestionas, por vista, las más recientes primero. Lo que espera tu aprobación está en «Actividades por aprobar».',
    segmentos: [
      VISTA('academica', 'Académicas', 'Todavía no hay actividades académicas.'),
      VISTA('extracurricular', 'Extracurriculares', 'Todavía no hay extracurriculares aprobadas.'),
      VISTA('externa', 'Externas', 'Todavía no hay oportunidades externas.'),
    ],
  },
  participaciones: {
    titulo: 'Participaciones', icono: <FiAward />, tono: 5, que: 'confirmadas',
    extra: (r) => (n(r.asistenciaAbierta)
      ? `${plural(n(r.asistenciaAbierta), 'actividad con la asistencia abierta', 'actividades con la asistencia abierta')}`
      : 'Ninguna actividad con la asistencia abierta'),
    resumen: 'Las últimas asistencias confirmadas y, por actividad, cuántos asistieron y si la asistencia sigue abierta.',
    segmentos: [
      { key: 'recientes', label: 'Recientes', destino: '/director/constancies', destinoLabel: 'Ir a Participaciones', vacio: 'Todavía no hay participaciones confirmadas.', destinoFila: participacion, destinoFilaLabel: 'Ver la actividad' },
      { key: 'asistencia', label: 'Asistencia', destino: '/director/constancies', destinoLabel: 'Ir a Participaciones', vacio: 'Ninguna actividad interna empezó todavía.', destinoFila: participacion, destinoFilaLabel: 'Ver la actividad' },
    ],
  },
  recursos: {
    titulo: 'Recursos', icono: <FiBookOpen />, tono: 2, que: 'publicados',
    extra: (r) => (n(r.propuestas) ? `${plural(n(r.propuestas), 'propuesta espera', 'propuestas esperan')} tu aprobación` : 'Sin propuestas pendientes'),
    resumen: 'Material de aprendizaje: las últimas altas y las propuestas de docentes que esperan tu aprobación.',
    segmentos: [
      { key: 'recientes', label: 'Recientes', destino: '/director/resources?status=all', destinoLabel: 'Ir a Recursos', vacio: 'Todavía no hay recursos.' },
      { key: 'propuestas', label: 'Propuestas pendientes', destino: '/director/approvals?tab=recursos', destinoLabel: 'Ir a las propuestas', vacio: 'Ninguna propuesta espera aprobación.' },
    ],
  },
  autonomia: {
    titulo: 'Autonomía docente', icono: <FiUnlock />, tono: 4, que: 'autorizaciones vigentes',
    extra: (r) => `${plural(n(r.docentes), 'docente', 'docentes')} con autonomía · ${n(r.revocadas)} revocadas`,
    resumen: 'Qué puede hacer cada docente sin pasar por Aprobaciones. Se concede y se revoca en Autonomía docente, no aquí.',
    segmentos: [
      { key: 'vigentes', label: 'Vigentes', destino: '/director/autonomy', destinoLabel: 'Ir a Autonomía docente', vacio: 'Ningún docente tiene autonomía hoy.' },
      { key: 'revocadas', label: 'Revocadas', destino: '/director/autonomy?status=revoked', destinoLabel: 'Ir a las revocadas', vacio: 'Ninguna autorización se revocó.' },
    ],
  },
  puntos: {
    titulo: 'Puntos de estudiantes', icono: <FiStar />, tono: 3, que: 'concesiones de puntos',
    extra: (r) => (n(r.propuestas) ? `${plural(n(r.propuestas), 'propuesta por revisar', 'propuestas por revisar')}` : 'Sin propuestas pendientes'),
    resumen: 'Los últimos puntos otorgados y las propuestas de docentes que esperan tu decisión.',
    segmentos: [
      { key: 'concesiones', label: 'Concesiones', destino: '/director/points', destinoLabel: 'Ir a Puntos de estudiantes', vacio: 'Todavía no se otorgaron puntos.' },
      { key: 'propuestas', label: 'Propuestas pendientes', destino: '/director/points?tab=propuestas', destinoLabel: 'Ir a las propuestas', vacio: 'Ninguna propuesta espera decisión.' },
    ],
  },
  analitica: {
    titulo: 'Cómo va la carrera', icono: <FiBarChart2 />, tono: 2, que: 'estudiantes con afinidad calculada',
    resumen: 'Las cifras de cada pestaña de Analítica, calculadas ahora. Son descriptivas: no miden rendimiento ni predicen.',
    segmentos: [{
      key: 'indicadores', label: 'Indicadores', destino: '/director/analytics', destinoLabel: 'Ir a Analítica', vacio: 'Todavía no hay datos.',
      destinoFila: (f) => (f.id === 'panorama' ? '/director/analytics' : `/director/analytics?tab=${f.id}`), destinoFilaLabel: 'Abrir esta pestaña',
    }],
  },
};

const GRUPOS: { id: string; titulo: string; descripcion: string; tarjetas: string[]; cols: 'cols-2' | 'cols-3' }[] = [
  { id: 'carrera', titulo: 'La carrera', descripcion: 'Estudiantes, actividades, participación y proyectos.', tarjetas: ['estudiantes', 'actividades', 'participaciones', 'proyectos'], cols: 'cols-2' },
  { id: 'seguimiento', titulo: 'Seguimiento', descripcion: 'Material, autonomía de docentes y puntos.', tarjetas: ['recursos', 'autonomia', 'puntos'], cols: 'cols-3' },
];

export default function DirectorDashboard() {
  const state = useAsync(() => reportService.directorHome(), []);
  const [abierta, setAbierta] = useState<string | null>(null);
  const cerrar = useCallback(() => setAbierta(null), []);
  const cargar = useCallback((segmento: string) => (abierta
    ? reportService.directorHomeDetail(abierta, segmento)
    : Promise.reject(new Error('sin tarjeta'))), [abierta]);

  const tarjeta = (o: InicioRol, id: string, atencion = false) => (
    <TarjetaInicio key={id} id={id} config={TARJETAS[id]} r={o.tarjetas[id]} atencion={atencion} onDetalles={() => setAbierta(id)} onReintentar={state.reload} />
  );

  return (
    <div className="inicio-admin inicio-direccion">
      <SaludoRol />
      <AsyncView loading={state.loading} error={state.error} data={state.data} skeleton={<SkeletonCards count={4} />}>
        {(o: InicioRol) => (
          <>
            <h2 className="ia-grupo-t">Lo que espera tu decisión</h2>
            <div className="grid cols-2 ia-atencion">
              {['aprobaciones', 'credenciales'].map((id) => tarjeta(o, id, true))}
            </div>

            {GRUPOS.map((g) => (
              <section key={g.id} className="ia-grupo" aria-labelledby={`id-${g.id}`}>
                <h2 className="ia-grupo-t" id={`id-${g.id}`}>{g.titulo}</h2>
                <p className="muted ia-grupo-d">{g.descripcion}</p>
                <div className={`grid ${g.cols}`}>{g.tarjetas.map((id) => tarjeta(o, id))}</div>
              </section>
            ))}

            <section className="ia-grupo" aria-labelledby="id-analitica">
              <h2 className="ia-grupo-t" id="id-analitica">Analítica</h2>
              <p className="muted ia-grupo-d">Indicadores descriptivos y agregados de la carrera.</p>
              <div className="grid cols-2">
                {tarjeta(o, 'analitica')}
                <Card title="Ir a una pestaña">
                  <div className="chip-row">
                    {[
                      ['', 'Panorama'], ['afinidad', 'Afinidad'], ['participacion', 'Participación'], ['demanda', 'Demanda'], ['evolucion', 'Evolución'],
                    ].map(([k, l]) => (
                      <Link key={l} className="chip" to={k ? `/director/analytics?tab=${k}` : '/director/analytics'}>{l}</Link>
                    ))}
                  </div>
                </Card>
              </div>
            </section>
          </>
        )}
      </AsyncView>

      {abierta && (
        <DetallesInicio
          key={abierta}
          titulo={TARJETAS[abierta].titulo}
          resumen={TARJETAS[abierta].resumen}
          segmentos={TARJETAS[abierta].segmentos}
          cargar={cargar}
          onClose={cerrar}
        />
      )}
    </div>
  );
}
