import { normalizeRadPi } from '../math/angles';

/**
 * Solve M = E - e sin E for elliptic orbits (0 <= e < 1).
 * Newton iteration (start per JPL "Approximate Positions" note), falling back to bisection,
 * which always converges because E - M lies in [-e, e].
 * Returns E in [-pi, pi] for the normalized mean anomaly.
 */
export function solveKeplerElliptic(meanAnomalyRad: number, e: number, tolerance = 1e-12): number {
  if (!(e >= 0 && e < 1)) {
    throw new RangeError(`solveKeplerElliptic: eccentricity must be in [0, 1), got ${e}`);
  }
  const m = normalizeRadPi(meanAnomalyRad);
  let E = e < 0.8 ? m + e * Math.sin(m) : m < 0 ? -Math.PI : Math.PI;
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= dE;
    if (!Number.isFinite(E)) break;
    if (Math.abs(dE) < tolerance) return E;
  }
  let lo = m - e;
  let hi = m + e;
  for (let i = 0; i < 200 && hi - lo > tolerance; i++) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) - m > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
