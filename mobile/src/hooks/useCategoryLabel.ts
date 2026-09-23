import { useEffect, useState } from 'react';
import { catalogService } from '../services';

/**
 * Nombre visible de una categoría de actividad, tomado del catálogo real.
 *
 * Las categorías las administra el administrador (§21): puede agregar una
 * mañana. Antes cada pantalla del móvil las traía escritas a mano, así que una
 * categoría nueva se mostraba con su valor interno —«club_estudio»— mientras la
 * web, que sí lee el catálogo, mostraba su nombre. Dos clientes, dos verdades,
 * sobre el mismo dato.
 *
 * Mientras el catálogo no ha llegado, o si la petición falla, se devuelve el
 * valor tal cual: es feo, pero es cierto, y no deja la fila vacía.
 */
export function useCategoryLabel(): (value: string) => string {
  const [nombres, setNombres] = useState<Record<string, string>>({});

  useEffect(() => {
    let vigente = true;
    catalogService
      .activityCategories()
      .then((categorias) => {
        if (!vigente) return;
        const mapa: Record<string, string> = {};
        categorias.forEach((c: { code?: string; name?: string }) => {
          if (c.code) mapa[c.code] = c.name ?? c.code;
        });
        setNombres(mapa);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  return (value: string) => nombres[value] ?? value;
}
