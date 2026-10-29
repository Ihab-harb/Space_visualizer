import { describe, expect, it } from 'vitest';
import { isInflated, satelliteHidden, satelliteShown } from './satelliteVisibility';

describe('satelliteShown', () => {
  it('shows the satellite when it is clear of its parent', () => {
    expect(satelliteShown({ separationPx: 30, parentRadiusPx: 5, selfRadiusPx: 3 })).toBe(true);
  });
  it('hides it when the discs would touch or overlap', () => {
    expect(satelliteShown({ separationPx: 10, parentRadiusPx: 5, selfRadiusPx: 3 })).toBe(false);
  });
  it('hides it exactly at the threshold (radii plus the 4 px margin)', () => {
    expect(satelliteShown({ separationPx: 12, parentRadiusPx: 5, selfRadiusPx: 3 })).toBe(false);
    expect(satelliteShown({ separationPx: 12.01, parentRadiusPx: 5, selfRadiusPx: 3 })).toBe(true);
  });
  it('honours a custom margin', () => {
    expect(satelliteShown({ separationPx: 10, parentRadiusPx: 5, selfRadiusPx: 3, marginPx: 1 })).toBe(true);
  });
});

describe('satelliteHidden', () => {
  const overlapping = { separationPx: 2, parentRadiusPx: 5, selfRadiusPx: 3 };
  const separated = { separationPx: 30, parentRadiusPx: 5, selfRadiusPx: 3 };
  it('never hides when both bodies are drawn at their true radii, even when they overlap', () => {
    expect(satelliteHidden({ ...overlapping, selfInflated: false, parentInflated: false })).toBe(false);
  });
  it('hides an overlap that readable-scale inflation causes (either body inflated)', () => {
    expect(satelliteHidden({ ...overlapping, selfInflated: true, parentInflated: false })).toBe(true);
    expect(satelliteHidden({ ...overlapping, selfInflated: false, parentInflated: true })).toBe(true);
  });
  it('shows an inflated satellite that is clear of the parent', () => {
    expect(satelliteHidden({ ...separated, selfInflated: true, parentInflated: true })).toBe(false);
  });
});

describe('isInflated', () => {
  it('is false at the true radius (1e-6 tolerance) and true above it', () => {
    expect(isInflated(1737.4, 1737.4)).toBe(false);
    expect(isInflated(1737.4 * (1 + 1e-7), 1737.4)).toBe(false);
    expect(isInflated(1737.4 * (1 + 1e-5), 1737.4)).toBe(true);
  });
});
