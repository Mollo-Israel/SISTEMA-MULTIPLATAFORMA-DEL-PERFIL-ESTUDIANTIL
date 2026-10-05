import { useCallback, useEffect, useRef, useState } from 'react';
import { apiError } from '../api/client';
import { claveDeps, viewCache } from './viewCache';

/**
 * Carga de datos de una pantalla, con memoria de la sesión.
 *
 * Si la pantalla ya se abrió, devuelve al instante lo último que mostró y
 * pide lo fresco en segundo plano (`loading` en `true` con `data` presente
 * significa «recargando»). Un pedido viejo que llega tarde se descarta.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const clave = `${fn.toString()}|${claveDeps(deps)}`;
  const [data, setDataState] = useState<T | null>(() => viewCache.get<T>(clave) ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);
  const claveRef = useRef(clave);
  claveRef.current = clave;

  const run = useCallback(() => {
    const mio = ++turno.current;
    const k = claveRef.current;
    if (viewCache.has(k)) setDataState(viewCache.get<T>(k) ?? null);
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (mio !== turno.current) return;
        setDataState(d);
        viewCache.set(k, d);
      })
      .catch((e) => {
        if (mio === turno.current) setError(apiError(e));
      })
      .finally(() => {
        if (mio === turno.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      turno.current++;
    };
  }, [run]);

  const setData = useCallback((valor: T | null | ((prev: T | null) => T | null)) => {
    setDataState((prev) => {
      const nuevo = typeof valor === 'function' ? (valor as (p: T | null) => T | null)(prev) : valor;
      if (nuevo != null) viewCache.set(claveRef.current, nuevo);
      return nuevo;
    });
  }, []);

  return { data, loading, error, reload: run, setData };
}
