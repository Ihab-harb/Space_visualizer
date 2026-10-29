import { describe, expect, it } from 'vitest';
import { TABLE1_RANGE, TABLE2_RANGE } from '../../test/approxOrbits';
import { makeEarth, makeJupiter, makeMoon, makeSun, MOON_TABLE_RANGE } from '../../test/fixtures';
import { calendarToJd } from '../time/julian';
import { bodyState, validityStatus } from './state';

const bodies = [makeSun(), makeEarth(), makeJupiter()];

describe('bodyState', () => {
  it('keeps fixed bodies at their position', () => {
    expect(bodyState(makeSun(), 2451545)).toEqual({ positionKm: [0, 0, 0], inValidRange: true, tableId: null });
  });
  it('dispatches planet-approx orbits', () => {
    const s = bodyState(makeEarth(), 2451545);
    expect(s.tableId).toBe('1800-2050');
    expect(Math.hypot(...s.positionKm)).toBeGreaterThan(1.4e8);
  });
});

describe('validityStatus', () => {
  it('reports the best table available for all bodies, across both table boundaries', () => {
    expect(validityStatus(bodies, 2451545)).toBe('high');
    expect(validityStatus(bodies, TABLE1_RANGE.to)).toBe('high');
    expect(validityStatus(bodies, TABLE1_RANGE.to + 0.001)).toBe('extended');
    expect(validityStatus(bodies, TABLE1_RANGE.from - 0.001)).toBe('extended');
    expect(validityStatus(bodies, TABLE2_RANGE.from - 0.001)).toBe('out-of-range');
    expect(validityStatus(bodies, TABLE2_RANGE.to + 0.001)).toBe('out-of-range');
  });
});

describe('satellites', () => {
  it('bodyState refuses a satellite', () => {
    expect(() => bodyState(makeMoon(), 2451545)).toThrow('use systemState for satellite bodies');
  });
  it('validityStatus is high inside the table and out-of-range on the mean elements (spec §3.2)', () => {
    const withMoon = [makeSun(), makeEarth(), makeMoon()];
    expect(validityStatus(withMoon, MOON_TABLE_RANGE.from + 1)).toBe('high');
    expect(validityStatus(withMoon, MOON_TABLE_RANGE.to + 1)).toBe('out-of-range');
    expect(validityStatus(withMoon, MOON_TABLE_RANGE.from - 1)).toBe('out-of-range');
    expect(validityStatus(withMoon, calendarToJd({ year: 3500, month: 1, day: 1, hour: 0, minute: 0, second: 0 }))).toBe('out-of-range');
  });
});
