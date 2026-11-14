import { describe, expect, it } from 'vitest';
import { DEG, normalizeRadPi } from '../math/angles';
import { solveKeplerElliptic } from './kepler';

describe('solveKeplerElliptic', () => {
  it('matches Meeus example 30.a (e = 0.1, M = 5 deg -> E = 5.554589 deg)', () => {
    expect(solveKeplerElliptic(5 * DEG, 0.1) / DEG).toBeCloseTo(5.554589, 6);
  });
  it('returns M for circular orbits', () => {
    expect(solveKeplerElliptic(1.234, 0)).toBeCloseTo(1.234, 14);
  });
  it.each([0.2, 0.5, 0.9, 0.99, 0.999999])('satisfies the equation for e = %d', (e) => {
    for (let m = -10; m <= 10; m += 0.37) {
      const E = solveKeplerElliptic(m, e);
      expect(Math.abs(E - e * Math.sin(E) - normalizeRadPi(m))).toBeLessThan(1e-10);
    }
  });
  it('rejects non-elliptic eccentricities', () => {
    expect(() => solveKeplerElliptic(1, 1)).toThrow(RangeError);
    expect(() => solveKeplerElliptic(1, -0.1)).toThrow(RangeError);
    expect(() => solveKeplerElliptic(1, Number.NaN)).toThrow(RangeError);
  });
});
