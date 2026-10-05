import { useCallback, useEffect, useRef, useState } from 'react';
import { apiError } from '../api/client';
import { claveDeps, viewCache } from './viewCache';

interface Opciones {
  /**
   * Identificador del dato. Por omisión se deriva de la pantalla, del
   * pedido y de sus dependencias: dos pantallas distintas nunca comparten.
   */
  key?: string;
  /** `false` para datos que no deben mostrarse viejos ni un instante. */
  cache?: boolean;
}

/**
 * Carga de datos de una vista, con memoria de la sesión.
 *
 * Si la vista ya se visitó, devuelve al instante lo último que mostró
 * (`loading` sigue en `true` mientras llega lo fresco, y `AsyncView` lo
 * trata como «recargando»: no cambia la tabla por un esqueleto). Un pedido
 * viejo que llega después de uno nuevo se descarta.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = [], opciones: Opciones = {}) {
  const usarMemoria = opciones.cache !== false;
  const clave = usarMemoria
    ? opciones.key ?? `${window.location.pathname}|${fn.toString()}|${claveDeps(deps)}`
    : null;

  const [data, setDataState] = useState<T | null>(() => (clave ? viewCache.get<T>(clave) ?? null : null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);
  const claveRef = useRef(clave);
  claveRef.current = clave;

  const run = useCallback(() => {
    const mio = ++turno.current;
    const k = claveRef.current;
    // Si cambiaron las dependencias y ya hay memoria para las nuevas, se
    // muestran al instante; si no, se conserva lo que había mientras carga.
    if (k && viewCache.has(k)) setDataState(viewCache.get<T>(k) ?? null);
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (mio !== turno.current) return;
        setDataState(d);
        if (k) viewCache.set(k, d);
      })
      .catch((e) => {
        if (mio !== turno.current) return;
        setError(apiError(e));
      })
      .finally(() => {
        if (mio === turno.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      // Al desmontar, ningún pedido en vuelo debe tocar el estado.
      turno.current++;
    };
  }, [run]);

  /** Actualización local (optimista) que también queda en la memoria. */
  const setData = useCallback((valor: T | null | ((prev: T | null) => T | null)) => {
    setDataState((prev) => {
      const nuevo = typeof valor === 'function' ? (valor as (p: T | null) => T | null)(prev) : valor;
      const k = claveRef.current;
      if (k && nuevo != null) viewCache.set(k, nuevo);
      return nuevo;
    });
  }, []);

  return { data, loading, error, reload: run, setData };
}
