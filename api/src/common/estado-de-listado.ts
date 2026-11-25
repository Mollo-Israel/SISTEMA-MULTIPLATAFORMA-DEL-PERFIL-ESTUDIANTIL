import { BadRequestException } from '@nestjs/common';
import { RolNombre } from '@perfil/shared';

/**
 * V7.1 §4.1 · Estado excluyente de un listado.
 *
 * Sustituye a las casillas «Mostrar también…». El servidor filtra antes de
 * que nadie pagine, así que el total que ve la persona es siempre el del
 * filtro elegido. Filtrar no borra ni cambia nada.
 */
export type EstadoDeCatalogo = 'active' | 'inactive' | 'all';
export const ESTADOS_DE_CATALOGO: readonly EstadoDeCatalogo[] = ['active', 'inactive', 'all'];

/**
 * Lee un filtro de la consulta (`?status=…`). Sin valor devuelve `undefined`
 * y el endpoint conserva su comportamiento anterior; un valor que no existe
 * es un 400 con el campo señalado, nunca un filtro ignorado en silencio.
 */
export function leerFiltro<T extends string>(
  crudo: string | undefined,
  validos: readonly T[],
  nombre = 'status',
): T | undefined {
  if (crudo === undefined || crudo === '') return undefined;
  if ((validos as readonly string[]).includes(crudo)) return crudo as T;
  const m = `El filtro «${nombre}» solo admite: ${validos.join(', ')}.`;
  throw new BadRequestException({ code: 'INVALID_LIST_FILTER', message: m, fields: { [nombre]: [m] } });
}

/**
 * Lo dado de baja es de Administración. Cualquier otro rol recibe solo lo
 * vigente, pida lo que pida. Administración, sin filtro, sigue recibiendo
 * todo, porque sus formularios lo usan para mostrar referencias históricas.
 */
export function estadoDeCatalogoPara(role: RolNombre | string, pedido: EstadoDeCatalogo | undefined): EstadoDeCatalogo {
  if (role !== RolNombre.ADMIN) return 'active';
  return pedido ?? 'all';
}

/** Condición sobre `isActive` según el estado pedido. */
export function condicionDeVigencia(estado: EstadoDeCatalogo): { isActive?: boolean } {
  if (estado === 'active') return { isActive: true };
  if (estado === 'inactive') return { isActive: false };
  return {};
}
