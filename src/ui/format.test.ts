import { describe, expect, it } from 'vitest';
import { formatAu, formatDistanceKm, formatDuration, formatFact, formatKm, formatLightTime, formatLightTimeShort, formatNumber, formatPeriodDays } from './format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [12756, '12,756'],
    [0.20563593, '0.205636'],
    [778.5e6, '778,500,000'],
    [1.898e27, '1.898 × 10²⁷'],
    [1.9884e30, '1.9884 × 10³⁰'],
    [0.00001, '1 × 10⁻⁵'],
    [-110, '-110'],
  ])('%d -> %s', (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });
});

describe('formatFact', () => {
  it('adds units with the right spacing and renders booleans and strings', () => {
    expect(formatFact({ unit: 'kg' }, 1.898e27)).toBe('1.898 × 10²⁷ kg');
    expect(formatFact({ unit: '°' }, 3.1)).toBe('3.1°');
    expect(formatFact({ unit: '°C' }, -110)).toBe('-110°C');
    expect(formatFact({ unit: '' }, 95)).toBe('95');
    expect(formatFact({ unit: '' }, true)).toBe('Yes');
    expect(formatFact({ unit: '' }, 'G2 V')).toBe('G2 V');
  });
});

describe('distances and light time', () => {
  it('shows km and AU', () => {
    expect(formatDistanceKm(149_597_870.7)).toBe('149,598,000 km (1.0000 AU)');
  });
  it('shows light time in s, min or h', () => {
    expect(formatLightTime(1.28)).toBe('1.3 s');
    expect(formatLightTime(499)).toBe('8 min 19 s');
    expect(formatLightTime(15_000)).toBe('4 h 10 min');
  });
  it('never shows 60 of a smaller unit after rounding', () => {
    expect(formatLightTime(59.97)).toBe('1 min 0 s');
    expect(formatLightTime(539.6)).toBe('9 min 0 s');
    expect(formatLightTime(14_370)).toBe('4 h 0 min');
    expect(formatLightTime(3599.6)).toBe('1 h 0 min');
  });
});

describe('short formats', () => {
  it('formatAu uses 3 decimals below 1 AU and 2 above', () => {
    expect(formatAu(149597870.7 * 0.387)).toBe('0.387 AU');
    expect(formatAu(149597870.7)).toBe('1.00 AU');
    expect(formatAu(149597870.7 * 4.956)).toBe('4.96 AU');
  });
  it('formatLightTimeShort picks s, min or h', () => {
    expect(formatLightTimeShort(1.3)).toBe('1.3 s');
    expect(formatLightTimeShort(498)).toBe('8.3 min');
    expect(formatLightTimeShort(3120)).toBe('52 min');
    expect(formatLightTimeShort(8 * 3600)).toBe('8.0 h');
  });
  it('formatDuration switches from hours to days at 48 h', () => {
    expect(formatDuration(47.9)).toBe('47.9 hours');
    expect(formatDuration(48)).toBe('2 days');
    expect(formatDuration(-5832.5)).toBe('243 days');
  });
  it('formatPeriodDays switches from days to years at 730 d', () => {
    expect(formatPeriodDays(687)).toBe('687 days');
    expect(formatPeriodDays(729.9)).toBe('729.9 days');
    expect(formatPeriodDays(730)).toBe('2 years');
    expect(formatPeriodDays(4331)).toBe('11.86 years');
  });
});

describe('formatKm', () => {
  it('groups thousands without decimals and keeps one decimal below 1,000 km', () => {
    expect(formatKm(384400)).toBe('384,400 km');
    expect(formatKm(384399.6)).toBe('384,400 km');
    expect(formatKm(1737.4)).toBe('1,737 km');
    expect(formatKm(412.34)).toBe('412.3 km');
  });
});
