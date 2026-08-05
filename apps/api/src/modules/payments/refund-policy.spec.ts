import { daysUntilDeparture, decideRefund } from './refund-policy';

const paidCents = 37_800;

function at(iso: string): Date {
  return new Date(iso);
}

describe('daysUntilDeparture', () => {
  it('counts whole days ahead', () => {
    expect(daysUntilDeparture(at('2027-05-10T00:00:00Z'), at('2027-05-01T00:00:00Z'))).toBe(9);
  });

  it('floors a partial day rather than rounding up', () => {
    // 6 days and 23 hours is still 6 days, so it lands in the 50% tier.
    expect(daysUntilDeparture(at('2027-05-08T23:00:00Z'), at('2027-05-02T00:00:00Z'))).toBe(6);
  });

  it('goes negative once departure has passed', () => {
    expect(daysUntilDeparture(at('2027-05-01T00:00:00Z'), at('2027-05-03T00:00:00Z'))).toBe(-2);
  });
});

describe('decideRefund', () => {
  it('refunds everything seven or more days out', () => {
    expect(
      decideRefund({ paidCents, startDate: at('2027-05-10T00:00:00Z'), now: at('2027-05-01T00:00:00Z') }),
    ).toMatchObject({ tier: 'FULL', percentage: 100, amountCents: 37_800 });
  });

  it('treats exactly seven days as the full-refund boundary', () => {
    expect(
      decideRefund({ paidCents, startDate: at('2027-05-08T00:00:00Z'), now: at('2027-05-01T00:00:00Z') }),
    ).toMatchObject({ tier: 'FULL', percentage: 100 });
  });

  it('refunds half between one and seven days out', () => {
    expect(
      decideRefund({ paidCents, startDate: at('2027-05-05T00:00:00Z'), now: at('2027-05-01T00:00:00Z') }),
    ).toMatchObject({ tier: 'HALF', percentage: 50, amountCents: 18_900 });
  });

  it('treats exactly one day as the half-refund boundary', () => {
    expect(
      decideRefund({ paidCents, startDate: at('2027-05-02T00:00:00Z'), now: at('2027-05-01T00:00:00Z') }),
    ).toMatchObject({ tier: 'HALF', percentage: 50 });
  });

  it('refunds nothing inside twenty-four hours', () => {
    expect(
      decideRefund({ paidCents, startDate: at('2027-05-01T20:00:00Z'), now: at('2027-05-01T00:00:00Z') }),
    ).toMatchObject({ tier: 'NONE', percentage: 0, amountCents: 0 });
  });

  it('refunds nothing after departure', () => {
    expect(
      decideRefund({ paidCents, startDate: at('2027-04-28T00:00:00Z'), now: at('2027-05-01T00:00:00Z') }),
    ).toMatchObject({ tier: 'NONE', amountCents: 0 });
  });

  it('rounds a half refund down to whole cents', () => {
    // 12 345 / 2 = 6 172.5 -> 6 172, never 6 173.
    expect(
      decideRefund({ paidCents: 12_345, startDate: at('2027-05-05T00:00:00Z'), now: at('2027-05-01T00:00:00Z') }),
    ).toMatchObject({ amountCents: 6172 });
  });

  it('never refunds more than was paid', () => {
    for (const days of [0, 1, 3, 7, 30]) {
      const start = new Date(at('2027-05-01T00:00:00Z').getTime() + days * 86_400_000);
      const decision = decideRefund({ paidCents, startDate: start, now: at('2027-05-01T00:00:00Z') });
      expect(decision.amountCents).toBeLessThanOrEqual(paidCents);
      expect(decision.amountCents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(decision.amountCents)).toBe(true);
    }
  });

  it('refunds nothing when nothing was paid', () => {
    expect(
      decideRefund({ paidCents: 0, startDate: at('2027-06-01T00:00:00Z'), now: at('2027-05-01T00:00:00Z') }),
    ).toMatchObject({ tier: 'FULL', amountCents: 0 });
  });

  it('explains the decision in words for the traveller', () => {
    const decision = decideRefund({
      paidCents,
      startDate: at('2027-05-05T00:00:00Z'),
      now: at('2027-05-01T00:00:00Z'),
    });

    expect(decision.reason).toMatch(/between one and seven days/i);
    expect(decision.daysUntilDeparture).toBe(4);
  });
});
