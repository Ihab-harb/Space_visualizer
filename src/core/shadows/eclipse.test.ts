import { describe, expect, it } from 'vitest';
import { rayHitsEllipsoid, rayPlaneRadius, sunVisibleFraction } from './eclipse';

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
