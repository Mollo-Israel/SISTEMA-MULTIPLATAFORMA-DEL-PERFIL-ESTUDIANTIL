import { createContext } from 'react';

/** Rutas ya abiertas en esta sesión (solo memoria). */
export const vistasVisitadas = new Set<string>();

/**
 * `true` mientras se muestra una vista por primera vez en la sesión. Las
 * animaciones de entrada lo consultan: al volver a una vista, su contenido
 * aparece quieto en lugar de volver a desvanecerse.
 */
export const PrimeraVisita = createContext(true);
