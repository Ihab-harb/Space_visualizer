import { describe, expect, it } from 'vitest';
import { DEG } from '../math/angles';
import { length, type Vec3 } from '../math/vec3';
import { orbitNormal, orbitPolylineKm, positionAtEccentricAnomaly, type ConicElements } from './conic';

const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
const circle = (over: Partial<ConicElements> = {}): ConicElements => ({
  aKm: 1000, e: 0, iRad: 0, nodeRad: 0, argPeriRad: 0, ...over,
});

describe('conic geometry', () => {
  it('places perihelion on +x for zero angles', () => {
    close(positionAtEccentricAnomaly(circle(), 0), [1000, 0, 0]);
  });
  it('rotates by the argument of perihelion', () => {
    close(positionAtEccentricAnomaly(circle({ argPeriRad: 90 * DEG }), 0), [0, 1000, 0]);
  });
  it('tilts by inclination about the node line', () => {
    close(positionAtEccentricAnomaly(circle({ iRad: 90 * DEG, argPeriRad: 90 * DEG }), 0), [0, 0, 1000]);
  });
  it('uses perihelion distance a(1 - e)', () => {
    expect(length(positionAtEccentricAnomaly(circle({ e: 0.5 }), 0))).toBeCloseTo(500, 9);
  });
  it('computes the orbit normal', () => {
    close(orbitNormal(circle()), [0, 0, 1]);
    close(orbitNormal(circle({ iRad: 90 * DEG })), [0, -1, 0]);
  });
  it('builds a closed polyline within perihelion and aphelion', () => {
    const el = circle({ e: 0.2, iRad: 0.3, nodeRad: 1, argPeriRad: 2 });
    const pts = orbitPolylineKm(el, 0.5, 64);
    expect(pts).toHaveLength(65);
    close(pts[0]!, pts[64]!);
    close(pts[0]!, positionAtEccentricAnomaly(el, 0.5));
    for (const p of pts) {
      expect(length(p)).toBeGreaterThanOrEqual(800 - 1e-6);
      expect(length(p)).toBeLessThanOrEqual(1200 + 1e-6);
    }
  });
});
