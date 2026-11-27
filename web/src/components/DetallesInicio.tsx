import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiRefreshCw } from 'react-icons/fi';
import type { DetalleTarjeta } from '../services';
import { formatearFechaHora } from '../lib/fechas';
import { Badge, Button, Modal, Tabs } from './ui';

/**
 * V7.1 §3.1 · «Detalles» de una tarjeta del Inicio: modal de solo lectura.
 *
 * Muestra el total real del conjunto y sus últimos 10, con fechas de Bolivia y
 * estados en palabras. No tiene ninguna acción que cambie datos: «Ir a
 * gestionar» lleva al módulo con el filtro del conjunto ya aplicado. El foco,
 * Escape y el regreso al botón que lo abrió los maneja `Modal`.
 *
 * Lo reutiliza el Inicio de Dirección (V7-12) con sus propias consultas: el
 * componente no decide permisos, solo muestra lo que la API de cada rol
 * entrega.
 */

export interface SegmentoDetalle {
  key: string;
  label: string;
  /** Destino en el módulo, con el filtro de este conjunto. */
  destino: string;
  destinoLabel?: string;
  /** Texto cuando el conjunto está vacío. */
  vacio?: string;
  /** Enlace a una fila concreta (p. ej. la actividad), si el módulo lo admite. */
  destinoFila?: (fila: { id: string; actividadId?: string }) => string | null;
}

export function DetallesInicio({ titulo, resumen, segmentos, inicial, cargar, onClose }: Readonly<{
  titulo: string;
  resumen: string;
  segmentos: SegmentoDetalle[];
  inicial?: string;
  cargar: (segmento: string) => Promise<DetalleTarjeta>;
  onClose: () => void;
}>) {
  const [actual, setActual] = useState(inicial && segmentos.some((s) => s.key === inicial) ? inicial : segmentos[0].key);
  const [datos, setDatos] = useState<DetalleTarjeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const segmento = segmentos.find((s) => s.key === actual) ?? segmentos[0];

  const traer = useCallback(async (clave: string, vivo: { ok: boolean }) => {
    setCargando(true);
    setError(null);
    setDatos(null);
    try {
      const d = await cargar(clave);
      if (vivo.ok) setDatos(d);
    } catch {
      // §3.1 (H13): un error se dice; nunca se muestra un cero como si fuera un dato.
      if (vivo.ok) setError('No se pudo cargar este detalle. Puedes intentarlo de nuevo.');
    } finally {
      if (vivo.ok) setCargando(false);
    }
  }, [cargar]);

  useEffect(() => {
    const vivo = { ok: true };
    void traer(actual, vivo);
    return () => { vivo.ok = false; };
  }, [actual, traer]);

  return (
    <Modal title={titulo} subtitle={resumen} onClose={onClose} width={720}>
      <div className="detalles-inicio" data-testid="detalles-inicio">
        {segmentos.length > 1 && (
          <Tabs items={segmentos.map((s) => ({ key: s.key, label: s.label }))} value={actual} onChange={setActual} />
        )}

        <div aria-live="polite" aria-busy={cargando}>
          {cargando && <p className="muted">Cargando…</p>}

          {error && (
            <div className="detalles-error" role="alert">
              <p>{error}</p>
              <Button variant="secondary" size="sm" icon={<FiRefreshCw />} onClick={() => void traer(actual, { ok: true })}>Reintentar</Button>
            </div>
          )}

          {datos && (
            <>
              <p className="detalles-total" data-testid="detalles-total">
                {datos.total === 0
                  ? 'No hay registros en este conjunto.'
                  : datos.total > datos.filas.length
                    ? <>Mostrando los <b>{datos.filas.length}</b> más recientes de <b>{datos.total}</b>.</>
                    : <><b>{datos.total}</b> {datos.total === 1 ? 'registro' : 'registros'}.</>}
              </p>
              {datos.nota && <p className="muted detalles-nota">{datos.nota}</p>}
              {datos.filas.length === 0 ? (
                <p className="detalles-vacio">{segmento.vacio ?? 'Nada por aquí por ahora.'}</p>
              ) : (
                <ol className="detalles-lista" data-testid="detalles-filas">
                  {datos.filas.map((f) => {
                    const enlace = segmento.destinoFila?.(f) ?? null;
                    return (
                      <li key={f.id} className="detalles-fila">
                        <div className="df-cabeza">
                          <strong>{f.titulo}</strong>
                          {f.estado && <Badge tone={f.estado.tono === 'blue' ? 'neutral' : f.estado.tono}>{f.estado.texto}</Badge>}
                        </div>
                        {f.detalle && <span className="muted df-detalle">{f.detalle}</span>}
                        {f.datos && f.datos.length > 0 && (
                          <dl className="df-datos">
                            {f.datos.map((d) => (
                              <div key={d.campo}><dt>{d.campo}</dt><dd>{d.valor}</dd></div>
                            ))}
                          </dl>
                        )}
                        <div className="df-pie">
                          <span className="muted">{f.fecha ? formatearFechaHora(f.fecha) : 'Sin fecha'}</span>
                          {enlace && <Link to={enlace} className="df-abrir">Abrir en el módulo <FiArrowRight size={12} /></Link>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </>
          )}
        </div>

        <div className="detalles-acciones">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Link to={segmento.destino} className="btn btn-primary" data-testid="detalles-ir">
            {segmento.destinoLabel ?? 'Ir a gestionar'} <FiArrowRight size={13} />
          </Link>
        </div>
      </div>
    </Modal>
  );
}
