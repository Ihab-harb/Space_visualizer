import { describe, expect, it } from 'vitest';
import { MOON_MEAN_ELEMENTS as M } from '../../test/fixtures';
import { DEG, normalizeDeg180 } from '../math/angles';
import { solveKeplerElliptic } from './kepler';
import { cross } from '../math/vec3';
import { meanElementAnglesAt, meanElementsGeocentricKm } from './meanElements';

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
    const at = (years: number) => meanElementAnglesAt(M, M.epochJdTdb + years * Y);
    expect(at(0).nodeDeg).toBeCloseTo(125.08, 9);
    expect(at(9.3).nodeDeg - at(0).nodeDeg).toBeCloseTo(-180, 9);
    expect(at(18.6).nodeDeg - at(0).nodeDeg).toBeCloseTo(-360, 9);
  });

  it('the position function uses the regressing node (orbit normal, not just the helper)', () => {
    // The plane itself turns ~0.05 deg per day, so the cross product of two close positions is off by ~0.03 deg.
    // Orbit normal n = (sin i sin node, -sin i cos node, cos i), so node = atan2(nx, -ny).
    const nodeFromPositions = (jd: number) => {
      const r1 = meanElementsGeocentricKm(M, jd);
      const r2 = meanElementsGeocentricKm(M, jd + 0.01);
      const n = cross(r1, r2);
      return Math.atan2(n[0], -n[1]) / DEG;
    };
    const t0 = M.epochJdTdb;
    expect(nodeFromPositions(t0)).toBeCloseTo(125.08, 1);
    expect(Math.abs(normalizeDeg180(nodeFromPositions(t0 + 9.3 * Y) - 125.08))).toBeCloseTo(180, 0);
    expect(normalizeDeg180(nodeFromPositions(t0 + 18.6 * Y) - 125.08)).toBeCloseTo(0, 0);
  });

  it('the apsis advances and the angles combine as M = lambda - varpi, omega = varpi - node', () => {
    const t = M.epochJdTdb + 1000;
    const a0 = meanElementAnglesAt(M, M.epochJdTdb);
    const a1 = meanElementAnglesAt(M, t);
    expect(a0.varpiDeg).toBeCloseTo(125.08 + 318.15, 9);
    expect(a1.varpiDeg - a0.varpiDeg).toBeCloseTo((360 * 1000) / (5.997 * Y), 9);
    expect(a1.varpiDeg - a0.varpiDeg).toBeGreaterThan(0);
    expect(a1.lambdaDeg - a0.lambdaDeg).toBeCloseTo((360 * 1000) / 27.322, 9);
    expect(normalizeDeg180(a1.meanAnomalyDeg - (a1.lambdaDeg - a1.varpiDeg))).toBeCloseTo(0, 9);
    expect(a1.argPeriDeg).toBeCloseTo(a1.varpiDeg - a1.nodeDeg, 9);
    // Perigee direction seen in the position: the nearest point moves prograde by ~60 deg per year.
    const perigeeLon = (jd: number) => {
      let best = jd;
      let bestR = Infinity;
      for (let d = -14; d <= 14; d += 0.01) {
        const rr = Math.hypot(...meanElementsGeocentricKm(M, jd + d));
        if (rr < bestR) {
          bestR = rr;
          best = jd + d;
        }
      }
      const r = meanElementsGeocentricKm(M, best);
      return Math.atan2(r[1], r[0]) / DEG;
    };
    const dLon = normalizeDeg180(perigeeLon(M.epochJdTdb + Y) - perigeeLon(M.epochJdTdb));
    // 360/5.997 = 60.03 deg of apsis motion; the perigee longitude also swings with the node, so allow a margin.
    expect(dLon).toBeGreaterThan(40);
    expect(dLon).toBeLessThan(80);
  });

  it('mean longitude advances one turn per sidereal period', () => {
    // Node and apsis frozen: one sidereal period returns to the same point.
    const frozen = { ...M, apsisPeriodYears: 1e12, nodePeriodYears: 1e12 };
    const a = meanElementsGeocentricKm(frozen, M.epochJdTdb);
    const b = meanElementsGeocentricKm(frozen, M.epochJdTdb + M.siderealPeriodDays);
    expect(dist(a, b)).toBeLessThan(0.01);
  });
});
