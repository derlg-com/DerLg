import { Prisma } from '@prisma/client';
import { computeRefund } from './compute-refund.util';

const D = (n: string) => new Prisma.Decimal(n);

describe('computeRefund', () => {
  const today = new Date('2026-08-01T00:00:00Z');

  it('returns 100% when start is > 7 days out (exact 8 days)', () => {
    const r = computeRefund(
      { startDate: new Date('2026-08-09'), totalUsd: D('100') },
      today,
    );
    expect(r.percentage).toBe(100);
    expect(r.amountUsd).toBe(100);
  });

  it('returns 50% at exact 7-day boundary', () => {
    const r = computeRefund(
      { startDate: new Date('2026-08-08'), totalUsd: D('100') },
      today,
    );
    expect(r.percentage).toBe(50);
    expect(r.amountUsd).toBe(50);
  });

  it('returns 50% in the 3-7 day window (5 days)', () => {
    const r = computeRefund(
      { startDate: new Date('2026-08-06'), totalUsd: D('200') },
      today,
    );
    expect(r.percentage).toBe(50);
    expect(r.amountUsd).toBe(100);
  });

  it('returns 50% at exact 4-day mark', () => {
    const r = computeRefund(
      { startDate: new Date('2026-08-05'), totalUsd: D('200') },
      today,
    );
    expect(r.percentage).toBe(50);
  });

  it('returns 0% at exact 3-day boundary', () => {
    const r = computeRefund(
      { startDate: new Date('2026-08-04'), totalUsd: D('200') },
      today,
    );
    expect(r.percentage).toBe(0);
    expect(r.amountUsd).toBe(0);
  });

  it('returns 0% inside 3 days (2 days out)', () => {
    const r = computeRefund(
      { startDate: new Date('2026-08-03'), totalUsd: D('200') },
      today,
    );
    expect(r.percentage).toBe(0);
  });

  it('returns 0% if booking already started', () => {
    const r = computeRefund(
      { startDate: new Date('2026-07-25'), totalUsd: D('200') },
      today,
    );
    expect(r.percentage).toBe(0);
  });

  it('handles zero amount cleanly', () => {
    const r = computeRefund(
      { startDate: new Date('2026-08-09'), totalUsd: D('0') },
      today,
    );
    expect(r.percentage).toBe(100);
    expect(r.amountUsd).toBe(0);
  });

  it('preserves decimal precision', () => {
    const r = computeRefund(
      { startDate: new Date('2026-08-06'), totalUsd: D('199.99') },
      today,
    );
    expect(r.percentage).toBe(50);
    expect(r.amountUsd).toBeCloseTo(99.995, 3);
  });
});
