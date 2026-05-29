import { checkOverlap } from './check-overlap.util';

describe('checkOverlap', () => {
  const target = {
    startDate: new Date('2026-08-10'),
    endDate: new Date('2026-08-12'),
  };

  it('returns false for empty existing list', () => {
    expect(checkOverlap([], target)).toBe(false);
  });

  it('detects fully-contained overlap', () => {
    expect(
      checkOverlap(
        [
          {
            startDate: new Date('2026-08-09'),
            endDate: new Date('2026-08-13'),
          },
        ],
        target,
      ),
    ).toBe(true);
  });

  it('detects partial-overlap (left)', () => {
    expect(
      checkOverlap(
        [
          {
            startDate: new Date('2026-08-09'),
            endDate: new Date('2026-08-11'),
          },
        ],
        target,
      ),
    ).toBe(true);
  });

  it('detects partial-overlap (right)', () => {
    expect(
      checkOverlap(
        [
          {
            startDate: new Date('2026-08-11'),
            endDate: new Date('2026-08-13'),
          },
        ],
        target,
      ),
    ).toBe(true);
  });

  it('detects exact-equal range', () => {
    expect(checkOverlap([target], target)).toBe(true);
  });

  it('treats adjacent ranges as non-overlapping (existing.end === target.start)', () => {
    expect(
      checkOverlap(
        [
          {
            startDate: new Date('2026-08-08'),
            endDate: new Date('2026-08-10'),
          },
        ],
        target,
      ),
    ).toBe(false);
  });

  it('treats adjacent ranges as non-overlapping (existing.start === target.end)', () => {
    expect(
      checkOverlap(
        [
          {
            startDate: new Date('2026-08-12'),
            endDate: new Date('2026-08-14'),
          },
        ],
        target,
      ),
    ).toBe(false);
  });

  it('handles single-day target (half-open: 1-day span [Aug 10, Aug 11))', () => {
    const oneDay = {
      startDate: new Date('2026-08-10'),
      endDate: new Date('2026-08-11'),
    };
    expect(checkOverlap([oneDay], oneDay)).toBe(true);
  });

  it('throws if target boundaries are swapped', () => {
    const swapped = {
      startDate: new Date('2026-08-12'),
      endDate: new Date('2026-08-10'),
    };
    expect(() => checkOverlap([], swapped)).toThrow(/start.*after.*end/i);
  });
});
