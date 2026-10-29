import { describe, expect, it } from 'vitest';
import { MOON_MEAN_ELEMENTS as M } from '../../test/fixtures';
import { DEG, normalizeDeg180 } from '../math/angles';
import { solveKeplerElliptic } from './kepler';
import { meanElementsGeocentricKm } from './meanElements';

const Y = 365.25;
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('meanElementsGeocentricKm', () => {
  it('at the epoch the position matches the stated elements', () => {
    const r = meanElementsGeocentricKm(M, M.epochJdTdb);
    const E = solveKeplerElliptic(135.27 * DEG, M.e);
    expect(Math.hypot(...r)).toBeCloseTo(M.aKm * (1 - M.e * Math.cos(E)), 4);
  });

  it('crosses the ecliptic northward near the stated ascending node longitude', () => {
    const z = (t: number) => meanElementsGeocentricKm(M, t)[2];
    let lo = 0;
    let hi = 0;
    for (let t = M.epochJdTdb - 14; t < M.epochJdTdb + 14; t += 0.25) {
      if (z(t) < 0 && z(t + 0.25) >= 0) {
        lo = t;
        hi = t + 0.25;
        break;
      }
    }
    expect(hi).toBeGreaterThan(lo);
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (z(mid) < 0) lo = mid;
      else hi = mid;
    }
    const r = meanElementsGeocentricKm(M, lo);
    const lon = Math.atan2(r[1], r[0]) / DEG;
    // The node regresses about 0.05 deg per day, so a crossing a few days from the epoch is slightly off 125.08.
    expect(Math.abs(normalizeDeg180(lon - 125.08))).toBeLessThan(3);
  });

  it('node regresses one turn in 18.600 years', () => {
    const node = (days: number) => M.nodeDeg - (360 * days) / (M.nodePeriodYears * Y);
    expect(normalizeDeg180(node(18.6 * Y) - node(0))).toBeCloseTo(0, 9);
    expect(Math.abs(normalizeDeg180(node(9.3 * Y) - node(0)))).toBeCloseTo(180, 9);
  });

  it('mean longitude advances one turn per sidereal period', () => {
    // Node and apsis frozen: one sidereal period returns to the same point.
    const frozen = { ...M, apsisPeriodYears: 1e12, nodePeriodYears: 1e12 };
    const a = meanElementsGeocentricKm(frozen, M.epochJdTdb);
    const b = meanElementsGeocentricKm(frozen, M.epochJdTdb + M.siderealPeriodDays);
    expect(dist(a, b)).toBeLessThan(0.01);
  });
});
