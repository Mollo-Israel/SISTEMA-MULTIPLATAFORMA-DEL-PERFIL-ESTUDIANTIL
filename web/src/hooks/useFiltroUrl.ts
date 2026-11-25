import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * V7.1 §3.1 y §4.1: los filtros de una grilla viven en la URL.
 *
 * Así se conservan al recargar y al volver atrás, y otra pantalla puede
 * llevar a la grilla ya filtrada (`/admin/users?status=pending_activation`).
 * Se escribe con `replace`: cambiar un filtro no llena el historial.
 *
 * El valor por omisión no se escribe en la URL. Un valor desconocido se lee
 * como el de omisión, así que un enlace viejo o mal escrito nunca rompe la
 * pantalla.
 */
export function useParametrosUrl() {
  const [params, setParams] = useSearchParams();

  const leer = useCallback(<T extends string>(nombre: string, porOmision: T, validos?: readonly T[]): T => {
    const crudo = params.get(nombre);
    if (crudo === null || crudo === '') return porOmision;
    if (validos && !(validos as readonly string[]).includes(crudo)) return porOmision;
    return crudo as T;
  }, [params]);

  /**
   * Cambia varios parámetros a la vez. `null`, '' o el valor por omisión
   * indicado en `omisiones` los quitan de la URL.
   */
  const actualizar = useCallback((cambios: Record<string, string | null | undefined>, omisiones: Record<string, string> = {}) => {
    setParams((prev) => {
      const sig = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(cambios)) {
        if (v === null || v === undefined || v === '' || v === omisiones[k]) sig.delete(k);
        else sig.set(k, v);
      }
      return sig;
    }, { replace: true });
  }, [setParams]);

  return { leer, actualizar };
}

/** Un único filtro excluyente en la URL: `[valor, cambiar]`. */
export function useFiltroUrl<T extends string>(nombre: string, porOmision: T, validos: readonly T[]) {
  const { leer, actualizar } = useParametrosUrl();
  const valor = leer(nombre, porOmision, validos);
  const cambiar = useCallback(
    (nuevo: T) => actualizar({ [nombre]: nuevo }, { [nombre]: porOmision }),
    [actualizar, nombre, porOmision],
  );
  return [valor, cambiar] as const;
}
