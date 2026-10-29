import { describe, expect, it } from 'vitest';
import { satelliteShown } from './satelliteVisibility';

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
