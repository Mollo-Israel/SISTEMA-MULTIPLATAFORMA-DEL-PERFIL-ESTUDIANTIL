/**
 * Capítulo III, §3.2.2 — Máquina de estados de las actividades.
 * Casos PT-AFI-01 a PT-AFI-14 del documento de grado.
 */
import { ActivityStatus as E, canTransition } from '@perfil/shared';

describe('Transiciones permitidas de actividades', () => {
  it.each([
    ['PT-AFI-01', E.DRAFT, E.PUBLISHED],
    ['PT-AFI-02', E.DRAFT, E.OPEN],
    ['PT-AFI-03', E.OPEN, E.CLOSED],
    ['PT-AFI-04', E.CLOSED, E.OPEN],
    ['PT-AFI-05', E.OPEN, E.FINISHED],
    ['PT-AFI-06', E.CLOSED, E.FINISHED],
    ['PT-AFI-07', E.OPEN, E.CANCELLED],
  ])('%s: permite %s → %s', (_codigo, desde, hacia) => {
    expect(canTransition(desde, hacia)).toBe(true);
  });
});

describe('Transiciones rechazadas de actividades', () => {
  it.each([
    ['PT-AFI-08', E.OPEN, E.DRAFT],
    ['PT-AFI-09', E.CLOSED, E.DRAFT],
    ['PT-AFI-10', E.FINISHED, E.OPEN],
    ['PT-AFI-11', E.FINISHED, E.DRAFT],
    ['PT-AFI-12', E.CANCELLED, E.OPEN],
    ['PT-AFI-13', E.CANCELLED, E.DRAFT],
  ])('%s: rechaza %s → %s', (_codigo, desde, hacia) => {
    expect(canTransition(desde, hacia)).toBe(false);
  });
});

describe('Permanencia en el mismo estado', () => {
  it('PT-AFI-14: open → open se trata como válida', () => {
    expect(canTransition(E.OPEN, E.OPEN)).toBe(true);
  });
});
