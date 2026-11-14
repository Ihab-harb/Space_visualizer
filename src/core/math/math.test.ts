import { describe, expect, it } from 'vitest';
import { DEG, normalizeDeg180, normalizeDeg360, normalizeRadPi } from './angles';
import { add, angleBetween, cross, distance, dot, length, lerp, normalize, scale, slerpDirection, sub, ZERO, type Vec3 } from './vec3';
import { apply, column, fromColumns, IDENTITY, mul, rotX, rotZ, transpose } from './mat3';

const close = (a: Vec3, b: Vec3, digits = 12) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, digits));

describe('angles', () => {
  it('normalizes degrees', () => {
    expect(normalizeDeg360(-90)).toBe(270);
    expect(normalizeDeg360(720)).toBe(0);
    expect(normalizeDeg360(-0)).toBe(0);
    expect(normalizeDeg180(270)).toBe(-90);
    expect(normalizeDeg180(180)).toBe(180);
    expect(normalizeDeg180(-180)).toBe(180);
  });
  it('normalizes radians to [-pi, pi]', () => {
    expect(normalizeRadPi(2.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI, 12);
    expect(normalizeRadPi(-1.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI, 12);
    expect(normalizeRadPi(0.25)).toBe(0.25);
  });
});

describe('vec3', () => {
  it('does arithmetic', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(scale([1, -2, 3], 2)).toEqual([2, -4, 6]);
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(length([3, 4, 12])).toBe(13);
    expect(distance([1, 1, 1], [4, 5, 1])).toBe(5);
    expect(lerp([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });
  it('normalizes and handles zero length', () => {
    close(normalize([0, 3, 4]), [0, 0.6, 0.8]);
    expect(normalize(ZERO)).toEqual([0, 0, 0]);
  });
  it('measures angles robustly, including tiny ones', () => {
    expect(angleBetween([1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2, 12);
    expect(angleBetween([1, 0, 0], [1, 1e-9, 0])).toBeCloseTo(1e-9, 18);
  });
  it('slerps between directions, including opposite ones', () => {
    close(slerpDirection([1, 0, 0], [0, 1, 0], 0.5), [Math.SQRT1_2, Math.SQRT1_2, 0]);
    close(slerpDirection([1, 0, 0], [0, 1, 0], 0), [1, 0, 0]);
    close(slerpDirection([1, 0, 0], [0, 1, 0], 1), [0, 1, 0]);
    const mid = slerpDirection([1, 0, 0], [-1, 0, 0], 0.5);
    expect(length(mid)).toBeCloseTo(1, 12);
    expect(dot(mid, [1, 0, 0])).toBeCloseTo(0, 12);
  });
});

describe('mat3', () => {
  it('rotZ is a passive frame rotation', () => {
    close(apply(rotZ(90 * DEG), [1, 0, 0]), [0, -1, 0]);
  });
  it('rotX is a passive frame rotation', () => {
    close(apply(rotX(90 * DEG), [0, 1, 0]), [0, 0, -1]);
  });
  it('multiplies, transposes and builds from columns', () => {
    const r = mul(rotZ(0.3), rotX(0.7));
    const back = mul(r, transpose(r));
    back.forEach((v, i) => expect(v).toBeCloseTo(IDENTITY[i]!, 12));
    const m = fromColumns([1, 2, 3], [4, 5, 6], [7, 8, 9]);
    expect(column(m, 1)).toEqual([4, 5, 6]);
    expect(apply(m, [1, 0, 0])).toEqual([1, 2, 3]);
  });
});
