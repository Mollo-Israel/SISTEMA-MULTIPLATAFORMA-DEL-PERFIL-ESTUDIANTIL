/**
 * Memoria de lo último que mostró cada pantalla, durante la sesión.
 *
 * Al volver a una pantalla ya vista se pinta al instante con estos datos y se
 * pide la versión fresca en segundo plano. Así abrir una pantalla no pasa por
 * «esqueleto → contenido» cada vez. Vive solo en memoria y se borra al
 * iniciar o cerrar sesión: nunca se ven datos de otra persona.
 */
const memoria = new Map<string, unknown>();
const MAXIMO = 200;

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
  clear(): void {
    memoria.clear();
  },
};

export function claveDeps(deps: unknown[]): string {
  try {
    return JSON.stringify(deps);
  } catch {
    return String(deps.length);
  }
}
