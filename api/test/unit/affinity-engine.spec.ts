import {
  DIMINISHING,
  diminishingFactor,
} from '../../../shared/src/enums/affinity-engine';

describe('Motor de Afinidad V2 - rendimientos decrecientes', () => {
  describe('Actividades confirmadas', () => {
    it.each([
      [0, 1.0],
      [1, 0.7],
      [2, 0.5],
      [3, 0.3],
      [4, 0.3],
      [5, 0.3],
    ])(
      'aplica el factor esperado para la señal con índice %i',
      (index, expected) => {
        expect(diminishingFactor(DIMINISHING.ACTIVITY, index)).toBe(expected);
      },
    );
  });

  describe('Proyectos', () => {
    it.each([
      [0, 1.0],
      [1, 0.75],
      [2, 0.5],
      [3, 0.25],
      [4, 0.25],
      [5, 0.25],
    ])(
      'aplica el factor esperado para la señal con índice %i',
      (index, expected) => {
        expect(diminishingFactor(DIMINISHING.PROJECT, index)).toBe(expected);
      },
    );
  });
});
