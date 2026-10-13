import { Fragment, useEffect, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiX } from 'react-icons/fi';
import { auditService, type AuditLogPage } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, PageHeader, Paginacion, SearchInput, SkeletonTable,
} from '../../components/ui';
import { formatearFechaHora } from '../../lib/fechas';

const POR_PAGINA = 10;

const TONO: Record<string, string> = { correcto: 'green', rechazado: 'red', cancelado: 'gray', moderado: 'amber' };
const ROL: Record<string, string> = {
  ADMIN: 'Administración', CAREER_DIRECTOR: 'Dirección', TEACHER: 'Docente', SCIENTIFIC_SOCIETY: 'Sociedad', STUDENT: 'Estudiante',
};

/**
 * Auditoría (V3.2 §59, C13): quién hizo qué, en qué módulo, cuándo y con qué
 * resultado, en palabras. Filtros que funcionan (módulo, acción, actor, fechas
 * y resultado), 10 por página y el detalle de cada evento al desplegarlo. El
 * servidor ya quitó del detalle cualquier dato sensible antes de guardarlo.
 */
export default function AdminAuditPage() {
  const catalogo = useAsync(() => auditService.catalog(), []);
  const [modulo, setModulo] = useState('');
  const [accion, setAccion] = useState('');
  const [actor, setActor] = useState('');
  const [actorBuscado, setActorBuscado] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resultado, setResultado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => setPagina(1), [modulo, accion, actorBuscado, desde, hasta, resultado]);
  useEffect(() => setAccion(''), [modulo]);

  const state = useAsync<AuditLogPage>(
    () => auditService.log({
      modulo: modulo || undefined,
      eventType: accion || undefined,
      actor: actorBuscado || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      resultado: resultado || undefined,
      limit: POR_PAGINA,
      offset: (pagina - 1) * POR_PAGINA,
    }),
    [modulo, accion, actorBuscado, desde, hasta, resultado, pagina],
  );

  const acciones = (catalogo.data?.acciones ?? []).filter((a) => !modulo || a.modulo === modulo);
  const hayFiltros = !!(modulo || accion || actorBuscado || desde || hasta || resultado);
  const limpiar = () => {
    setModulo(''); setAccion(''); setActor(''); setActorBuscado(''); setDesde(''); setHasta(''); setResultado('');
  };
  const total = state.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Quién hizo qué, en qué módulo, cuándo y con qué resultado. El detalle nunca incluye contraseñas, tokens ni códigos."
      />
      <Card title="Eventos">
        <div className="filters audit-filters">
          <select value={modulo} onChange={(e) => setModulo(e.target.value)} aria-label="Módulo">
            <option value="">Todos los módulos</option>
            {(catalogo.data?.modulos ?? []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={accion} onChange={(e) => setAccion(e.target.value)} aria-label="Acción">
            <option value="">Todas las acciones</option>
            {acciones.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <SearchInput value={actor} onChange={setActor} onDebouncedChange={(v) => setActorBuscado(v.trim())} placeholder="Actor: nombre, correo o «Sistema»" />
          <label className="audit-fecha">Desde <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="audit-fecha">Hasta <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} /></label>
          <select value={resultado} onChange={(e) => setResultado(e.target.value)} aria-label="Resultado">
            <option value="">Todos los resultados</option>
            {(catalogo.data?.resultados ?? []).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <Button variant="ghost" size="sm" icon={<FiX size={14} />} disabled={!hayFiltros} onClick={limpiar}>Limpiar</Button>
        </div>
        <AsyncView
          loading={state.loading}
          error={state.error}
          data={state.data}
          skeleton={<SkeletonTable rows={8} columns={5} />}
          isEmpty={(d: AuditLogPage) => d.items.length === 0}
          emptyMessage="No hay eventos con esos filtros."
        >
          {(d: AuditLogPage) => (
            <>
              <div className="table-scroll">
                <table className="tabla-apilable">
                  <thead>
                    <tr><th>Actor</th><th>Módulo</th><th>Acción</th><th>Fecha</th><th>Resultado</th><th><span className="sr-only">Detalle</span></th></tr>
                  </thead>
                  <tbody>
                    {d.items.map((e) => (
                      <Fragment key={e.id}>
                        <tr>
                          <td>
                            <strong>{e.actor}</strong>
                            {e.actorRol && <div className="muted small">{ROL[e.actorRol] ?? e.actorRol}</div>}
                          </td>
                          <td>{e.modulo}</td>
                          <td>
                            {e.accion}
                            {e.sobre && <div className="muted small">Sobre: {e.sobre}</div>}
                          </td>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>{formatearFechaHora(e.fecha)}</td>
                          <td><Badge tone={TONO[e.resultadoCodigo] ?? 'gray'}>{e.resultado}</Badge></td>
                          <td>
                            {e.detalle.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-expanded={abierto === e.id}
                                onClick={() => setAbierto(abierto === e.id ? null : e.id)}
                              >
                                {abierto === e.id ? <FiChevronUp /> : <FiChevronDown />} Detalle
                              </button>
                            )}
                          </td>
                        </tr>
                        {abierto === e.id && (
                          <tr className="audit-detalle">
                            <td colSpan={6}>
                              <dl className="detail-list">
                                {e.detalle.map((x, k) => (
                                  <Fragment key={k}><dt>{x.campo}</dt><dd>{x.valor}</dd></Fragment>
                                ))}
                                <dt>Código del evento</dt><dd><code>{e.eventType}</code></dd>
                              </dl>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacion
                pagina={pagina}
                paginas={paginas}
                total={total}
                desde={total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1}
                hasta={Math.min(pagina * POR_PAGINA, total)}
                ir={(n) => setPagina(Math.min(Math.max(1, n), paginas))}
                noun="eventos"
              />
            </>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
