import { parseTtlSeconds } from './ttl';

describe('parseTtlSeconds', () => {
  it.each([
    ['15m', 900],
    ['1h', 3600],
    ['7d', 604_800],
    ['30s', 30],
    ['3600', 3600],
    [' 15m ', 900],
  ])('converts %s to %i seconds', (input, expected) => {
    expect(parseTtlSeconds(input)).toBe(expected);
  });

  it('falls back for unparseable input rather than producing NaN', () => {
    expect(parseTtlSeconds('soon')).toBe(900);
    expect(parseTtlSeconds('')).toBe(900);
    expect(parseTtlSeconds('15 weeks', 60)).toBe(60);
  });
});
