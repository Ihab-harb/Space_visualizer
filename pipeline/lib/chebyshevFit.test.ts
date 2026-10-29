import { describe, expect, it } from 'vitest';
import type { ChebyshevFile } from '../../src/core/catalog/schema';
import { evaluateChebyshev } from '../../src/core/ephemeris/chebyshev';
import type { Vec3 } from '../../src/core/math/vec3';
import { fitChebyshev, fitTable } from './chebyshevFit';

const R = 384400;
const PERIOD = 27.32;
const orbit = (jd: number): Vec3 => {
  const a = (2 * Math.PI * jd) / PERIOD;
  return [R * Math.cos(a), R * Math.sin(a), 0.1 * R * Math.sin(a)];
};
const fileOf = (segments: number[][], segmentDays: number, degree: number): ChebyshevFile => ({
  schemaVersion: 1, bodyId: 'moon', centreId: 'earth', frame: 'ecliptic-j2000', unit: 'km', sourceId: 't', startJdTdb: 0, segmentDays, degree, segments,
});
const synth = (days: number) => {
  const out: Array<{ jdTdb: number; positionKm: Vec3 }> = [];
  for (let jd = 0; jd <= days + 1e-9; jd += 0.25) out.push({ jdTdb: jd, positionKm: orbit(jd) });
  return out;
};

describe('fitChebyshev', () => {
  it('recovers exact coefficients of a degree-4 polynomial', () => {
    const truth = [3, -2, 0.5, 1.5, -0.25];
    const T = (n: number, x: number) => Math.cos(n * Math.acos(x));
    const samples = Array.from({ length: 40 }, (_, i) => {
      const t = -1 + (2 * i) / 39;
      return { t, v: truth.reduce((s, c, n) => s + c * T(n, t), 0) };
    });
    const got = fitChebyshev(samples, 4);
    truth.forEach((c, i) => expect(Math.abs(got[i]! - c)).toBeLessThan(1e-9));
  });
});

describe('fitTable', () => {
  it('fits a circular orbit to under 0.01 km with 16-day segments and degree 12', () => {
    const days = 160;
    const even = synth(days);
    const segments = fitTable(even, { startJdTdb: 0, segmentDays: 16, degree: 12, roundKm: 0 });
    const file = fileOf(segments, 16, 12);
    expect(segments).toHaveLength(10);
    let worst = 0;
    for (let jd = 0.125; jd < days; jd += 0.25) {
      const p = evaluateChebyshev(file, jd)!;
      const t = orbit(jd);
      worst = Math.max(worst, Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]));
    }
    expect(worst).toBeLessThan(0.01);
  });
  it('rounded coefficients serialise with at most 3 decimals', () => {
    const segs = fitTable(synth(32), { startJdTdb: 0, segmentDays: 16, degree: 12, roundKm: 0.001 });
    for (const c of segs.flat()) expect(String(c)).toMatch(/^-?\d+(\.\d{1,3})?$/);
  });
  it('rounding to 0.001 km moves each axis by at most (degree+1) * 0.0005 km', () => {
    const days = 64;
    const samples = synth(days);
    const exact = fileOf(fitTable(samples, { startJdTdb: 0, segmentDays: 16, degree: 12, roundKm: 0 }), 16, 12);
    const rounded = fileOf(fitTable(samples, { startJdTdb: 0, segmentDays: 16, degree: 12, roundKm: 0.001 }), 16, 12);
    let worst = 0;
    for (let jd = 0.125; jd < days; jd += 0.25) {
      const a = evaluateChebyshev(exact, jd)!;
      const b = evaluateChebyshev(rounded, jd)!;
      worst = Math.max(worst, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
    }
    expect(worst).toBeLessThanOrEqual((12 + 1) * 0.0005 + 1e-9);
  });
});
