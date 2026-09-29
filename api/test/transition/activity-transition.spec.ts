import {
  ActivityStatus,
  canTransition,
} from '../../../shared/src/enums/activity.enum';

describe('Transición de estados de actividades', () => {
  describe('Transiciones permitidas', () => {
    it.each([
      [ActivityStatus.DRAFT, ActivityStatus.PUBLISHED],
      [ActivityStatus.DRAFT, ActivityStatus.OPEN],
      [ActivityStatus.OPEN, ActivityStatus.CLOSED],
      [ActivityStatus.CLOSED, ActivityStatus.OPEN],
      [ActivityStatus.OPEN, ActivityStatus.FINISHED],
      [ActivityStatus.CLOSED, ActivityStatus.FINISHED],
      [ActivityStatus.OPEN, ActivityStatus.CANCELLED],
    ])(
      'permite %s -> %s',
      (from, to) => {
        expect(canTransition(from, to)).toBe(true);
      },
    );
  });

  describe('Transiciones no permitidas', () => {
    it.each([
      [ActivityStatus.OPEN, ActivityStatus.DRAFT],
      [ActivityStatus.CLOSED, ActivityStatus.DRAFT],
      [ActivityStatus.FINISHED, ActivityStatus.OPEN],
      [ActivityStatus.FINISHED, ActivityStatus.DRAFT],
      [ActivityStatus.CANCELLED, ActivityStatus.OPEN],
      [ActivityStatus.CANCELLED, ActivityStatus.DRAFT],
    ])(
      'rechaza %s -> %s',
      (from, to) => {
        expect(canTransition(from, to)).toBe(false);
      },
    );
  });

  it('considera válida una transición al mismo estado', () => {
    expect(
      canTransition(ActivityStatus.OPEN, ActivityStatus.OPEN),
    ).toBe(true);
  });
});
