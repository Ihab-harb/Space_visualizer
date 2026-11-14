import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { makeEarth, makeJupiter, makeMoon, makeMoonTable, makeSun } from '../test/fixtures';
import { apply, mul, rotX, rotZ } from '../core/math/mat3';
import { createFrameState, updateBodies } from './frameState';
import { pixelsPerRadian, renderRadiusKm } from './scaleMode';
import { writeMatrix4 } from './threeMath';

describe('updateBodies', () => {
  it('stores positions, validity and orientation for each body', () => {
    const frame = createFrameState();
    updateBodies(frame, [makeSun(), makeEarth(), makeJupiter()], new Map(), 2451545);
    expect(frame.jdTdb).toBe(2451545);
    expect(frame.bodyPositionsKm.get('sun')).toEqual([0, 0, 0]);
    expect(Math.hypot(...frame.bodyPositionsKm.get('jupiter')!)).toBeGreaterThan(7e8);
    expect(frame.bodyInValidRange.get('earth')).toBe(true);
    expect(frame.bodyOrientation.get('earth')).toHaveLength(9);
  });
});

describe('updateBodies with the Moon', () => {
  it('places the Moon about 384,000 km from Earth', () => {
    const frame = createFrameState();
    updateBodies(frame, [makeSun(), makeEarth(), makeMoon()], new Map([['moon', makeMoonTable()]]), 2451545 + 3);
    const e = frame.bodyPositionsKm.get('earth')!;
    const m = frame.bodyPositionsKm.get('moon')!;
    const d = Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]);
    expect(d).toBeGreaterThan(356000);
    expect(d).toBeLessThan(407000);
    expect(frame.bodyInValidRange.get('moon')).toBe(true);
    expect(frame.bodyOrientation.has('moon')).toBe(false);
  });
});

describe('renderRadiusKm', () => {
  const ppr = pixelsPerRadian(800, (50 * Math.PI) / 180);
  it('returns the true radius in true-scale mode', () => {
    expect(renderRadiusKm(6378, 1e9, 'true', 5, ppr)).toBe(6378);
  });
  it('enforces a minimum on-screen size in readable mode when far away', () => {
    const r = renderRadiusKm(6378, 1e9, 'readable', 5, ppr);
    expect((r / 1e9) * ppr).toBeCloseTo(5, 6);
  });
  it('uses the true radius in readable mode when close', () => {
    expect(renderRadiusKm(6378, 20000, 'readable', 5, ppr)).toBe(6378);
  });
});

describe('writeMatrix4', () => {
  it('produces a Three.js rotation equivalent to the core matrix', () => {
    const m = mul(rotZ(0.4), rotX(1.1));
    const q = new Quaternion().setFromRotationMatrix(writeMatrix4(m, new Matrix4()));
    const v = new Vector3(0.2, -0.5, 0.8).applyQuaternion(q);
    const expected = apply(m, [0.2, -0.5, 0.8]);
    expect(v.x).toBeCloseTo(expected[0], 12);
    expect(v.y).toBeCloseTo(expected[1], 12);
    expect(v.z).toBeCloseTo(expected[2], 12);
  });
});
