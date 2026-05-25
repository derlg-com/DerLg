import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  formatWeekday,
  convertFromUsd,
} from '@/lib/format';

describe('formatCurrency', () => {
  it('formats USD as $189.00 in en locale', () => {
    expect(formatCurrency(189, 'en')).toBe('$189.00');
  });

  it('formats USD with two decimals', () => {
    expect(formatCurrency(189.5, 'en')).toBe('$189.50');
  });

  it('formats KHR with no decimals and ៛ symbol in km locale', () => {
    const result = formatCurrency(189, 'km');
    expect(result).toMatch(/៛/);
    expect(result).not.toMatch(/\./);
    expect(result).toMatch(/774[,.]?\s?900/);
  });

  it('formats CNY with ¥ symbol in zh locale', () => {
    const result = formatCurrency(189, 'zh');
    expect(result).toMatch(/¥/);
    expect(result).toMatch(/1[,.]?\s?361/);
  });

  it('respects currency override', () => {
    expect(formatCurrency(189, 'en', 'USD')).toBe('$189.00');
  });

  it('handles zero amount', () => {
    expect(formatCurrency(0, 'en')).toBe('$0.00');
  });
});

describe('convertFromUsd', () => {
  it('returns same value for USD', () => {
    expect(convertFromUsd(189, 'USD')).toBe(189);
  });

  it('converts USD to KHR at 4100 rate', () => {
    expect(convertFromUsd(1, 'KHR')).toBe(4100);
  });

  it('converts USD to CNY at 7.2 rate', () => {
    expect(convertFromUsd(10, 'CNY')).toBeCloseTo(72);
  });
});

describe('formatDate', () => {
  const testDate = '2026-05-10T00:00:00Z';

  it('formats date in en-US locale (May 10, 2026 style)', () => {
    const result = formatDate(testDate, 'en');
    expect(result).toMatch(/May/);
    expect(result).toMatch(/2026/);
  });

  it('formats date in zh-CN locale (2026年5月10日 style)', () => {
    const result = formatDate(testDate, 'zh');
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/年/);
    expect(result).toMatch(/月/);
    expect(result).toMatch(/日/);
  });

  it('formats date in km-KH locale (Khmer numerals)', () => {
    const result = formatDate(testDate, 'km');
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result).toBe('string');
  });
});

describe('formatDateShort', () => {
  it('formats short date in en locale', () => {
    const result = formatDateShort('2026-05-10', 'en');
    expect(result).toMatch(/May/);
    expect(result).toMatch(/2026/);
  });
});

describe('formatWeekday', () => {
  it('returns short weekday name', () => {
    const result = formatWeekday('2026-05-10', 'en');
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(10);
  });
});
