import { describe, expect, it } from 'vitest';
import { ATMOSPHERE_PRESETS, atmosphereUniforms } from './AtmosphereShell';

describe('atmosphere presets', () => {
  it('derives O’Neil constants for Earth', () => {
    const u = atmosphereUniforms(ATMOSPHERE_PRESETS.earth, 8);
    expect(u.uInvWavelength[2]).toBeCloseTo(1 / Math.pow(0.475, 4), 6);
    expect(u.uKrESun).toBeCloseTo(0.0025 * 20, 12);
    expect(u.uKr4PI).toBeCloseTo(0.0025 * 4 * Math.PI, 12);
    expect(u.uOuter).toBe(1.025);
    expect(u.uSamples).toBe(8);
  });
  it('keeps every shell outside the camera’s minimum distance (1.2 radii)', () => {
    for (const p of Object.values(ATMOSPHERE_PRESETS)) expect(p.outer).toBeLessThan(1.2);
  });
});
