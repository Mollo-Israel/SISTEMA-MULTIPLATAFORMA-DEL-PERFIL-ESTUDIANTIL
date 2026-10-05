import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
/**
 * Memoria de lo último que mostró cada vista, durante la sesión.
 *
 * Al volver a una pantalla ya vista se pinta al instante con estos datos y se
 * pide la versión fresca en segundo plano (stale-while-revalidate). Así el
 * cambio de vista no pasa por «vacío → esqueleto → contenido», que era el
 * parpadeo que se veía en cada navegación.
 *
 * Vive solo en memoria (no en localStorage): se pierde al recargar y se borra
 * al iniciar o cerrar sesión, para que nunca se vean datos de otra persona.
 */
const memoria = new Map<string, unknown>();

/** Tope de entradas: suficiente para una sesión, sin crecer sin límite. */
const MAXIMO = 300;

export const viewCache = {
  get<T>(clave: string): T | undefined {
    return memoria.get(clave) as T | undefined;
  },
  has(clave: string): boolean {
    return memoria.has(clave);
  },
  set<T>(clave: string, valor: T): void {
    if (memoria.has(clave)) memoria.delete(clave);
    memoria.set(clave, valor);
    if (memoria.size > MAXIMO) {
      const primera = memoria.keys().next().value;
      if (primera !== undefined) memoria.delete(primera);
    }
  },
  /** Al cambiar de usuario: nada de la sesión anterior puede quedar. */
  clear(): void {
    memoria.clear();
  },
};

/** Clave estable de unas dependencias (las que no se serializan, se ignoran). */
export function claveDeps(deps: unknown[]): string {
  try {
    return JSON.stringify(deps);
  } catch {
    return String(deps.length);
  }
}

/**
 * `useState` con memoria de la sesión, para vistas que cargan sus datos a mano.
 *
 * La primera vez arranca en `inicial`; al volver a la vista arranca con lo
 * último guardado, así la pantalla se pinta completa mientras se refresca.
 * La clave lleva la ruta: dos pantallas no comparten estado por accidente.
 */
export function useCachedState<T>(nombre: string, inicial: T): [T, Dispatch<SetStateAction<T>>] {
  const clave = `estado|${window.location.pathname}|${nombre}`;
  const [valor, setValor] = useState<T>(() => (viewCache.has(clave) ? (viewCache.get<T>(clave) as T) : inicial));
  const set = useCallback<Dispatch<SetStateAction<T>>>((v) => {
    setValor((prev) => {
      const nuevo = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      viewCache.set(clave, nuevo);
      return nuevo;
    });
  }, [clave]);
  return [valor, set];
}

/** `true` si la vista ya tiene en memoria ese estado (para no mostrar esqueleto). */
export function enMemoria(nombre: string): boolean {
  return viewCache.has(`estado|${window.location.pathname}|${nombre}`);
}
