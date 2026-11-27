import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAward, FiBookOpen, FiCalendar, FiCheckSquare, FiCompass, FiFileText, FiFolder, FiGlobe, FiLayers,
  FiRefreshCw, FiShield, FiStar, FiTag, FiTool, FiUpload, FiUserCheck,
} from 'react-icons/fi';
import { useAsync } from '../../hooks/useAsync';
import { reportService, type InicioAdmin, type ResumenTarjeta } from '../../services';
import { formatearFechaHora } from '../../lib/fechas';
import { AsyncView, Button, Card, SkeletonCards } from '../../components/ui';
import { SaludoRol } from '../../components/InicioRol';
import { DetallesInicio, type SegmentoDetalle } from '../../components/DetallesInicio';

/**
 * V7.1 §3 · Inicio de Administración: un tablero de trabajo diario.
 *
 * Cada tarjeta muestra su total real y un botón «Detalles» que abre un modal
 * de solo lectura con los últimos 10 del conjunto y «Ir a gestionar», que
 * lleva al módulo con el filtro ya aplicado. Nada se aprueba, reenvía ni da de
 * baja desde aquí. La tarjeta Correo ya no está: la configuración técnica
 * sigue en /admin/mail, sin entrada en el menú.
 */

interface ConfigTarjeta {
  titulo: string;
  icono: ReactNode;
  /** Qué cuenta el número grande, en una línea. */
  que: string;
  /** Línea secundaria con otros totales del resumen. */
  extra?: (r: Record<string, unknown>) => string | null;
  resumen: string;
  segmentos: SegmentoDetalle[];
  /** Color del icono (paleta compartida con los inicios de los otros roles). */
  tono: 0 | 1 | 2 | 3 | 4 | 5;
}

const n = (v: unknown) => Number(v ?? 0);
const actividad = (vista: string) => (f: { actividadId?: string }) =>
  f.actividadId ? `/admin/activities?vista=${vista}&actividad=${f.actividadId}` : null;

const INTERNA = (vista: 'academica' | 'extracurricular', nombre: string): SegmentoDetalle[] => [
  { key: 'recientes', label: 'Recientes', destino: `/admin/activities?vista=${vista}`, vacio: `Todavía no hay actividades ${nombre}.` },
  { key: 'revision', label: 'En revisión', destino: `/admin/activities?vista=${vista}&review=pending`, destinoLabel: 'Ir a las que esperan revisión', vacio: 'Ninguna espera la decisión de Dirección.' },
  {
    key: 'entrega', label: 'Entrega institucional', destino: `/admin/activities?vista=${vista}`,
    vacio: 'No hay actividades que entreguen un documento institucional.', destinoFila: actividad(vista),
  },
];

const TARJETAS: Record<string, ConfigTarjeta> = {
  cuentas: {
    titulo: 'Cuentas sin activar', icono: <FiUserCheck />, tono: 4, que: 'esperan activación',
    resumen: 'Cuentas creadas que todavía no se activaron. La activación se reenvía desde Usuarios.',
    segmentos: [{ key: 'pendientes', label: 'Sin activar', destino: '/admin/users?status=pending_activation', destinoLabel: 'Ir a cuentas sin activar', vacio: 'Todas las cuentas están activadas.' }],
  },
  revision: {
    titulo: 'Actividades en revisión', icono: <FiCheckSquare />, tono: 3, que: 'esperan a Dirección',
    extra: (r) => `${n(r.academica)} académicas · ${n(r.extracurricular)} extracurriculares · ${n(r.externa)} externas`,
    resumen: 'Propuestas enviadas que decide Dirección. Administración las ve en solo lectura.',
    segmentos: [
      { key: 'academica', label: 'Académicas', destino: '/admin/activities?vista=academica&review=pending', vacio: 'Ninguna académica en revisión.' },
      { key: 'extracurricular', label: 'Extracurriculares', destino: '/admin/activities?vista=extracurricular&review=pending', vacio: 'Ninguna extracurricular en revisión.' },
      { key: 'externa', label: 'Externas', destino: '/admin/activities?vista=externa&review=pending', vacio: 'Ninguna externa en revisión.' },
    ],
  },
  credenciales: {
    titulo: 'Credenciales en revisión', icono: <FiShield />, tono: 1, que: 'pendientes de decisión',
    extra: (r) => (n(r.observadas) ? `${n(r.observadas)} observadas esperan corrección` : null),
    resumen: 'Credenciales externas que esperan la decisión de Dirección. Lo ya decidido está en su propia vista.',
    segmentos: [
      { key: 'pendientes', label: 'Pendientes', destino: '/admin/credential-reviews', destinoLabel: 'Ir a revisión de credenciales', vacio: 'Ninguna credencial espera decisión.' },
      { key: 'observadas', label: 'Observadas', destino: '/admin/credential-reviews?estado=observadas', vacio: 'Ninguna observada.' },
      { key: 'decididas', label: 'Decididas', destino: '/admin/credential-reviews?estado=decididas', vacio: 'Todavía no hay decisiones.' },
    ],
  },
  pedidos: {
    titulo: 'Pedidos de tecnologías', icono: <FiTool />, tono: 5, que: 'sin decidir',
    resumen: 'Tecnologías que estudiantes y docentes pidieron agregar al catálogo.',
    segmentos: [{ key: 'pendientes', label: 'Sin decidir', destino: '/admin/skill-requests', destinoLabel: 'Ir a pedidos de tecnologías', vacio: 'No hay pedidos sin decidir.' }],
  },
  padron: {
    titulo: 'Padrón', icono: <FiUpload />, tono: 4, que: 'importaciones aplicadas',
    extra: (r) => (r.ultima ? `Última: ${formatearFechaHora(String(r.ultima))}` : 'Todavía no se aplicó ninguna'),
    resumen: 'Importaciones del padrón ya aplicadas, con su resumen de filas.',
    segmentos: [{ key: 'aplicadas', label: 'Aplicadas', destino: '/admin/imports', destinoLabel: 'Ir a importar padrón', vacio: 'Todavía no se aplicó ninguna importación.' }],
  },
  auditoria: {
    titulo: 'Auditoría', icono: <FiFileText />, tono: 1, que: 'eventos en 7 días',
    resumen: 'Lo último que quedó registrado: quién, qué acción y sobre qué. Sin datos de acceso.',
    segmentos: [{ key: 'recientes', label: 'Últimos 7 días', destino: '/admin/audit', destinoLabel: 'Ir a auditoría', vacio: 'Sin eventos en los últimos 7 días.' }],
  },
  catalogo: {
    titulo: 'Áreas y tecnologías', icono: <FiLayers />, tono: 2, que: 'vigentes en el catálogo',
    extra: (r) => `${n(r.areas)} áreas · ${n(r.tecnologias)} tecnologías`,
    resumen: 'Las últimas altas del catálogo, vigentes o dadas de baja.',
    segmentos: [
      { key: 'areas', label: 'Áreas', destino: '/admin/areas?status=all', destinoLabel: 'Ir a áreas', vacio: 'No hay áreas.' },
      { key: 'tecnologias', label: 'Tecnologías', destino: '/admin/areas?tab=skills&status=all', destinoLabel: 'Ir a tecnologías', vacio: 'No hay tecnologías.' },
    ],
  },
  categorias: {
    titulo: 'Categorías', icono: <FiTag />, tono: 0, que: 'vigentes',
    resumen: 'Las últimas categorías de actividad que se crearon, con su vigencia.',
    segmentos: [{ key: 'recientes', label: 'Recientes', destino: '/admin/activity-categories?status=all', destinoLabel: 'Ir a categorías', vacio: 'No hay categorías.' }],
  },
  academicas: {
    titulo: 'Actividades académicas', icono: <FiCalendar />, tono: 4, que: 'internas',
    extra: (r) => `${n(r.revision)} en revisión · ${n(r.entrega)} con documento institucional`,
    resumen: 'Actividades académicas internas: las recientes, las que esperan revisión y la entrega de documentos.',
    segmentos: INTERNA('academica', 'académicas'),
  },
  extracurriculares: {
    titulo: 'Actividades extracurriculares', icono: <FiCompass />, tono: 0, que: 'internas',
    extra: (r) => `${n(r.revision)} en revisión · ${n(r.entrega)} con documento institucional`,
    resumen: 'Solo actividades extracurriculares internas, con las mismas tres vistas.',
    segmentos: INTERNA('extracurricular', 'extracurriculares'),
  },
  externas: {
    titulo: 'Oportunidades externas', icono: <FiGlobe />, tono: 5, que: 'oportunidades',
    extra: (r) => `${n(r.vinculadas)} credenciales vinculadas · ${n(r.historicas)} históricas`,
    resumen: 'Cursos y certificaciones de terceros: cobertura de credenciales por oportunidad y las últimas presentadas.',
    segmentos: [
      { key: 'recientes', label: 'Recientes', destino: '/admin/activities?vista=externa', vacio: 'Todavía no hay oportunidades externas.' },
      { key: 'revision', label: 'En revisión', destino: '/admin/activities?vista=externa&review=pending', vacio: 'Ninguna espera revisión.' },
      { key: 'cobertura', label: 'Cobertura', destino: '/admin/activities?vista=externa', vacio: 'No hay oportunidades externas.', destinoFila: actividad('externa') },
      { key: 'vinculadas', label: 'Vinculadas', destino: '/admin/credential-reviews?estado=todas', destinoLabel: 'Ir a revisión de credenciales', vacio: 'Ninguna credencial vinculada todavía.' },
      { key: 'historicas', label: 'Históricas', destino: '/admin/credential-reviews?estado=todas', destinoLabel: 'Ir a revisión de credenciales', vacio: 'Ninguna credencial histórica todavía.' },
    ],
  },
  recursos: {
    titulo: 'Recursos', icono: <FiBookOpen />, tono: 2, que: 'publicados',
    extra: (r) => (n(r.propuestas) ? `${n(r.propuestas)} propuestas esperan aprobación` : 'Sin propuestas pendientes'),
    resumen: 'Material de aprendizaje: las últimas altas y las propuestas que esperan la aprobación de Dirección.',
    segmentos: [
      { key: 'recientes', label: 'Recientes', destino: '/admin/resources?status=all', destinoLabel: 'Ir a recursos', vacio: 'Todavía no hay recursos.' },
      { key: 'propuestas', label: 'Propuestas pendientes', destino: '/admin/resources', destinoLabel: 'Ir a recursos', vacio: 'Ninguna propuesta espera aprobación.' },
    ],
  },
  proyectos: {
    titulo: 'Proyectos de la carrera', icono: <FiFolder />, tono: 1, que: 'activos y compartidos',
    resumen: 'Los proyectos activos que sus responsables compartieron. Nunca borradores ni privados, y sin evidencias.',
    segmentos: [{ key: 'recientes', label: 'Recientes', destino: '/proyectos', destinoLabel: 'Ir a proyectos de la carrera', vacio: 'Todavía no hay proyectos compartidos.' }],
  },
  puntos: {
    titulo: 'Puntos de estudiantes', icono: <FiAward />, tono: 3, que: 'concesiones de puntos',
    extra: (r) => (n(r.propuestas) ? `${n(r.propuestas)} propuestas por revisar` : 'Sin propuestas pendientes'),
    resumen: 'Los últimos puntos otorgados y las propuestas de docentes que esperan decisión.',
    segmentos: [
      { key: 'concesiones', label: 'Concesiones', destino: '/admin/points', destinoLabel: 'Ir a puntos de estudiantes', vacio: 'Todavía no se otorgaron puntos.' },
      { key: 'propuestas', label: 'Propuestas pendientes', destino: '/admin/points?tab=propuestas', destinoLabel: 'Ir a propuestas', vacio: 'Ninguna propuesta espera decisión.' },
    ],
  },
  gamificacion: {
    titulo: 'Gamificación', icono: <FiStar />, tono: 0, que: 'criterios vigentes',
    extra: (r) => (n(r.extras) ? `${n(r.extras)} extras de temporada vigentes` : 'Sin temporada de extras vigente'),
    resumen: 'Cómo se ganan los puntos hoy: criterios vigentes y extras de temporada con sus fechas.',
    segmentos: [
      { key: 'criterios', label: 'Criterios', destino: '/admin/gamification', destinoLabel: 'Ir a gamificación', vacio: 'No hay criterios vigentes.' },
      { key: 'extras', label: 'Extras de temporada', destino: '/admin/gamification', destinoLabel: 'Ir a gamificación', vacio: 'No hay una temporada de extras vigente hoy.' },
    ],
  },
};

const GRUPOS: { titulo: string; descripcion: string; tarjetas: string[] }[] = [
  { titulo: 'Identidad', descripcion: 'Quién entra a Afinia y qué quedó registrado.', tarjetas: ['padron', 'auditoria'] },
  { titulo: 'Catálogos', descripcion: 'Las listas que usan todos los módulos.', tarjetas: ['catalogo', 'categorias'] },
  { titulo: 'Gestión', descripcion: 'Actividades, oportunidades, recursos y proyectos.', tarjetas: ['academicas', 'extracurriculares', 'externas', 'recursos', 'proyectos'] },
  { titulo: 'Seguimiento', descripcion: 'Puntos y reglas de la gamificación.', tarjetas: ['puntos', 'gamificacion'] },
];

const ESTADO_DE_ROL: Record<string, { label: string; param: string | null; segmento: string }> = {
  todas: { label: 'Todas', param: 'all', segmento: 'todas' },
  active: { label: 'Activas', param: null, segmento: 'active' },
  pending_activation: { label: 'Sin activar', param: 'pending_activation', segmento: 'pending_activation' },
};

interface Abierto { tarjeta: string; rol?: { role: string; label: string; estado: string } }

export default function AdminHomePage() {
  const state = useAsync(() => reportService.adminHome(), []);
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const cerrar = useCallback(() => setAbierto(null), []);

  const cargar = useCallback((segmento: string) => {
    if (!abierto) return Promise.reject(new Error('sin tarjeta'));
    if (abierto.rol) return reportService.adminHomeDetail('roles', abierto.rol.role, abierto.rol.estado);
    return reportService.adminHomeDetail(abierto.tarjeta, segmento);
  }, [abierto]);

  return (
    <div className="inicio-admin">
      <SaludoRol />
      <AsyncView loading={state.loading} error={state.error} data={state.data} skeleton={<SkeletonCards count={4} />}>
        {(o: InicioAdmin) => (
          <>
            <h2 className="ia-grupo-t">Requiere tu atención</h2>
            <div className="grid cols-4 ia-atencion">
              {['cuentas', 'revision', 'credenciales', 'pedidos'].map((id) => (
                <Tarjeta key={id} id={id} r={o.tarjetas[id]} atencion onDetalles={() => setAbierto({ tarjeta: id })} onReintentar={state.reload} />
              ))}
            </div>

            <section className="ia-grupo" aria-labelledby="ia-identidad">
              <h2 className="ia-grupo-t" id="ia-identidad">Identidad</h2>
              <p className="muted ia-grupo-d">{GRUPOS[0].descripcion}</p>
              <CuentasPorRol r={o.tarjetas.roles} onAbrir={(rol) => setAbierto({ tarjeta: 'roles', rol })} onReintentar={state.reload} />
              <div className="grid cols-2">
                {GRUPOS[0].tarjetas.map((id) => (
                  <Tarjeta key={id} id={id} r={o.tarjetas[id]} onDetalles={() => setAbierto({ tarjeta: id })} onReintentar={state.reload} />
                ))}
              </div>
            </section>

            {GRUPOS.slice(1).map((g) => (
              <section key={g.titulo} className="ia-grupo" aria-labelledby={`ia-${g.titulo}`}>
                <h2 className="ia-grupo-t" id={`ia-${g.titulo}`}>{g.titulo}</h2>
                <p className="muted ia-grupo-d">{g.descripcion}</p>
                <div className="grid cols-3">
                  {g.tarjetas.map((id) => (
                    <Tarjeta key={id} id={id} r={o.tarjetas[id]} onDetalles={() => setAbierto({ tarjeta: id })} onReintentar={state.reload} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </AsyncView>

      {abierto && (abierto.rol ? (
        <DetallesInicio
          key={`rol-${abierto.rol.role}-${abierto.rol.estado}`}
          titulo={`Cuentas de ${abierto.rol.label}: ${ESTADO_DE_ROL[abierto.rol.estado].label.toLowerCase()}`}
          resumen="Las últimas cuentas de este rol, con su estado. Para cambiar algo, ve a Usuarios."
          segmentos={[{
            key: abierto.rol.role,
            label: abierto.rol.label,
            destino: `/admin/users?role=${abierto.rol.role}${ESTADO_DE_ROL[abierto.rol.estado].param ? `&status=${ESTADO_DE_ROL[abierto.rol.estado].param}` : ''}`,
            destinoLabel: 'Ir a usuarios con este filtro',
            vacio: 'No hay cuentas en este conjunto.',
          }]}
          cargar={cargar}
          onClose={cerrar}
        />
      ) : (
        <DetallesInicio
          key={abierto.tarjeta}
          titulo={TARJETAS[abierto.tarjeta].titulo}
          resumen={TARJETAS[abierto.tarjeta].resumen}
          segmentos={TARJETAS[abierto.tarjeta].segmentos}
          cargar={cargar}
          onClose={cerrar}
        />
      ))}
    </div>
  );
}

function Tarjeta({ id, r, atencion = false, onDetalles, onReintentar }: Readonly<{
  id: string;
  r: ResumenTarjeta | undefined;
  atencion?: boolean;
  onDetalles: () => void;
  onReintentar: () => void;
}>) {
  const c = TARJETAS[id];
  const fallo = !r || 'error' in r;
  const total = fallo ? 0 : n(r.total);
  return (
    <div className={`card ia-tarjeta t${c.tono} ${atencion && !fallo && total > 0 ? 'con' : ''}`} data-testid={`tarjeta-${id}`}>
      <div className="ia-cabeza">
        <span className="ia-ico" aria-hidden>{c.icono}</span>
        <strong className="ia-titulo">{c.titulo}</strong>
      </div>
      {fallo ? (
        <div className="ia-error" role="alert">
          <span>No se pudo cargar este resumen.</span>
          <Button variant="ghost" size="sm" icon={<FiRefreshCw />} onClick={onReintentar}>Reintentar</Button>
        </div>
      ) : (
        <>
          <p className="ia-cifra"><span className="ia-n" data-testid={`total-${id}`}>{total}</span> <span className="muted">{c.que}</span></p>
          {c.extra && <p className="muted ia-extra">{c.extra(r)}</p>}
          <button type="button" className="btn btn-secondary btn-sm ia-detalles" aria-haspopup="dialog" onClick={onDetalles}>
            Detalles
          </button>
        </>
      )}
    </div>
  );
}

function CuentasPorRol({ r, onAbrir, onReintentar }: Readonly<{
  r: ResumenTarjeta | undefined;
  onAbrir: (rol: { role: string; label: string; estado: string }) => void;
  onReintentar: () => void;
}>) {
  const roles = r && !('error' in r) ? (r.roles as { role: string; label: string; total: number; active: number; pendingActivation: number }[]) : null;
  return (
    <Card title="Cuentas por rol" actions={<Link to="/admin/users?status=all" className="btn btn-ghost btn-sm">Ir a usuarios</Link>}>
      {!roles ? (
        <div className="ia-error" role="alert">
          <span>No se pudo cargar este resumen.</span>
          <Button variant="ghost" size="sm" icon={<FiRefreshCw />} onClick={onReintentar}>Reintentar</Button>
        </div>
      ) : (
        <div className="scroll-x">
          <table className="ia-roles" data-testid="cuentas-por-rol">
            <thead>
              <tr><th>Rol</th><th className="num">Total</th><th className="num">Activas</th><th className="num">Sin activar</th></tr>
            </thead>
            <tbody>
              {roles.map((x) => (
                <tr key={x.role}>
                  <th scope="row">{x.label}</th>
                  {([['todas', x.total], ['active', x.active], ['pending_activation', x.pendingActivation]] as const).map(([estado, valor]) => (
                    <td key={estado} className="num">
                      <button
                        type="button"
                        className="ia-celda"
                        aria-haspopup="dialog"
                        aria-label={`${x.label}: ${valor} ${ESTADO_DE_ROL[estado].label.toLowerCase()}. Ver detalles`}
                        onClick={() => onAbrir({ role: x.role, label: x.label, estado })}
                      >
                        {valor}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
