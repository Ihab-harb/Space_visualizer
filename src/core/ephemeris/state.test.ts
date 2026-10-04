import { describe, expect, it } from 'vitest';
import { TABLE1_RANGE, TABLE2_RANGE } from '../../test/approxOrbits';
import { makeEarth, makeJupiter, makeSun } from '../../test/fixtures';
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
