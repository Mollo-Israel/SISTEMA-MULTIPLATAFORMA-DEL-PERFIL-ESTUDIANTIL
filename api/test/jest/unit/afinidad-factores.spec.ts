/**
 * Capítulo III, §3.2.1 — Motor de Afinidad V2: rendimientos decrecientes.
 * Casos PU-AFI-01 (actividades) y PU-AFI-02 (proyectos) del documento de grado.
 */
import { DIMINISHING, diminishingFactor } from '@perfil/shared';

describe('PU-AFI-01 · Factor decreciente para actividades', () => {
  it.each([
    ['PU-AFI-01.1', 0, 1.0],
    ['PU-AFI-01.2', 1, 0.7],
    ['PU-AFI-01.3', 2, 0.5],
    ['PU-AFI-01.4', 3, 0.3],
    ['PU-AFI-01.5', 4, 0.3],
    ['PU-AFI-01.6', 5, 0.3],
  ])('%s: la señal con índice %i recibe el factor %d', (_codigo, indice, esperado) => {
    expect(diminishingFactor(DIMINISHING.ACTIVITY, indice)).toBe(esperado);
  });
});

describe('PU-AFI-02 · Factor decreciente para proyectos', () => {
  it.each([
    ['PU-AFI-02.1', 0, 1.0],
    ['PU-AFI-02.2', 1, 0.75],
    ['PU-AFI-02.3', 2, 0.5],
    ['PU-AFI-02.4', 3, 0.25],
    ['PU-AFI-02.5', 4, 0.25],
    ['PU-AFI-02.6', 5, 0.25],
  ])('%s: la señal con índice %i recibe el factor %d', (_codigo, indice, esperado) => {
    expect(diminishingFactor(DIMINISHING.PROJECT, indice)).toBe(esperado);
  });
});
