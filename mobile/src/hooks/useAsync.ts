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
/**
 * Clave de la memoria de una pantalla: el código de la función que carga y sus
 * dependencias. Hermes (la app compilada y Expo Go) no conserva ese código:
 * toString() devuelve lo mismo para todas las funciones y dos pantallas
 * distintas compartirían datos (Mi trayectoria recibía los de otra pantalla y
 * se cerraba). Sin código disponible, la pantalla no usa la memoria.
 */
export function claveDeVista(fn: () => unknown, deps: unknown[]): string | null {
  const fuente = fn.toString();
  if (/\[(bytecode|native code)\]/.test(fuente)) return null;
  return `${fuente}|${claveDeps(deps)}`;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const clave = claveDeVista(fn, deps);
  const [data, setData] = useState<T | null>(() => (clave ? viewCache.get<T>(clave) ?? null : null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const turno = useRef(0);
  const claveRef = useRef(clave);
  claveRef.current = clave;

  const run = useCallback(() => {
    const mio = ++turno.current;
    const k = claveRef.current;
    if (k && viewCache.has(k)) setData(viewCache.get<T>(k) ?? null);
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (mio !== turno.current) return;
        setData(d);
        if (k) viewCache.set(k, d);
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

  const guardarData = useCallback((valor: T | null | ((prev: T | null) => T | null)) => {
    setData((prev) => {
      const nuevo = typeof valor === 'function' ? (valor as (p: T | null) => T | null)(prev) : valor;
      if (nuevo != null && claveRef.current) viewCache.set(claveRef.current, nuevo);
      return nuevo;
    });
  }, []);

  return { data, loading, error, reload: run, setData: guardarData };
}
