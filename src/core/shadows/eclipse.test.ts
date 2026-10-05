import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../math/vec3';
import { rayHitsEllipsoid, rayPlaneRadius, sunVisibilityFromObserver, sunVisibleFraction } from './eclipse';

describe('sunVisibleFraction', () => {
  it('is 1 with no overlap and 0 in totality', () => {
    expect(sunVisibleFraction(0.01, 0.01, 0.05)).toBe(1);
    expect(sunVisibleFraction(0.01, 0.02, 0.001)).toBe(0);
  });
  it('handles annular eclipses', () => {
    expect(sunVisibleFraction(0.02, 0.01, 0)).toBeCloseTo(0.75, 9);
  });
  it('matches the analytic overlap for equal discs one radius apart', () => {
    expect(sunVisibleFraction(1, 1, 1)).toBeCloseTo(0.609, 3);
  });
});

describe('ray helpers', () => {
  it('finds where a ray crosses the ring plane', () => {
    expect(rayPlaneRadius([0, 0, 1], [1, 0, -1])).toBeCloseTo(1, 12);
    expect(rayPlaneRadius([0, 0, 1], [0, 0, 1])).toBeNull();
    expect(rayPlaneRadius([3, 0, 0], [0, 0, 1])).toBeNull();
  });
  it('detects hits on a flattened body, forward only', () => {
    expect(rayHitsEllipsoid([3, 0, 0], [-1, 0, 0], 0.9)).toBe(true);
    expect(rayHitsEllipsoid([3, 0, 0], [1, 0, 0], 0.9)).toBe(false);
    expect(rayHitsEllipsoid([0, 0, 3], [0, 1, -1], 0.9)).toBe(false);
  });
});

describe('sunVisibilityFromObserver', () => {
  const sun: Vec3 = [1000, 0, 0];
  it('is fully visible with nothing in the way', () => {
    expect(sunVisibilityFromObserver([0, 0, 0], sun, 10, [])).toBe(1);
    expect(sunVisibilityFromObserver([0, 0, 0], sun, 10, [{ posKm: [0, 500, 0], radiusKm: 50 }])).toBe(1);
  });
  it('is hidden by a planet straight in front of it', () => {
    expect(sunVisibilityFromObserver([0, 0, 0], sun, 10, [{ posKm: [100, 0, 0], radiusKm: 20 }])).toBe(0);
  });
  it('ignores bodies behind the Sun', () => {
    expect(sunVisibilityFromObserver([0, 0, 0], sun, 10, [{ posKm: [2000, 0, 0], radiusKm: 500 }])).toBe(1);
  });
  it('dims partially when a limb covers part of the disc', () => {
    // Sun angular radius ~0.01 rad; occluder of equal angular size offset by one radius.
    const v = sunVisibilityFromObserver([0, 0, 0], sun, 10, [{ posKm: [100, 1, 0], radiusKm: 1 }]);
    expect(v).toBeGreaterThan(0.2);
    expect(v).toBeLessThan(0.8);
  });
});