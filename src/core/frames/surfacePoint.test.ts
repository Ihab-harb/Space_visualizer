import { describe, expect, it } from 'vitest';
import { SphereGeometry } from 'three';
import type { Vec3 } from '../math/vec3';
import { surfaceDirection, surfacePoint } from './surfacePoint';

function expectVec(actual: Vec3, expected: Vec3, digits = 9): void {
  for (let i = 0; i < 3; i++) expect(actual[i]).toBeCloseTo(expected[i]!, digits);
}

describe('surfaceDirection', () => {
  it('puts longitude 0 on +x and 90 east on +y', () => {
    expectVec(surfaceDirection(0, 0), [1, 0, 0]);
    expectVec(surfaceDirection(0, 90), [0, 1, 0]);
  });
  it('has no NaN at the poles and ignores longitude there', () => {
    expectVec(surfaceDirection(90, 123), [0, 0, 1]);
    expectVec(surfaceDirection(-90, 0), [0, 0, -1]);
  });
  it('scales z by the flattening in surfacePoint', () => {
    expectVec(surfacePoint(90, 0, 0.9), [0, 0, 0.9]);
    expectVec(surfacePoint(0, 0, 0.9), [1, 0, 0]);
  });
  it('agrees with the mesh: every vertex of the rotated SphereGeometry sits at surfaceDirection of its uv', () => {
    const g = new SphereGeometry(1, 16, 8).rotateX(Math.PI / 2);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      const v = uv.getY(i);
      if (v < 1e-6 || v > 1 - 1e-6) continue;
      const lon = (uv.getX(i) - 0.5) * 360;
      const lat = (v - 0.5) * 180;
      expectVec([pos.getX(i), pos.getY(i), pos.getZ(i)], surfaceDirection(lat, lon), 6);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });
});
