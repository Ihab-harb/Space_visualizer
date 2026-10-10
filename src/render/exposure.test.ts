import { describe, expect, it } from 'vitest';
import { damp, EXPOSURE, flareOpacity, godRayOpacity, sceneExposure, sunFrameWeight } from './exposure';

describe('scene-driven exposure', () => {
  it('weights the Sun by visibility and position in frame', () => {
    expect(sunFrameWeight(1, [0, 0])).toBe(1);
    expect(sunFrameWeight(0.5, [0.2, -0.3])).toBe(0.5);
    expect(sunFrameWeight(1, [1.15, 0])).toBeCloseTo(0.5, 6);
    expect(sunFrameWeight(1, [2, 0])).toBe(0);
    expect(sunFrameWeight(1, null)).toBe(0);
  });
  it('leaves exposure and the sky alone when the Sun is not in frame', () => {
    expect(sceneExposure(0, 0.1)).toEqual({ exposure: 1, skyDim: 1 });
  });
  it('dips exposure more for a large Sun and dims the stars', () => {
    const small = sceneExposure(1, 1e-6);
    const large = sceneExposure(1, EXPOSURE.fullSizeRad);
    expect(small.exposure).toBeCloseTo(1 - EXPOSURE.minDip, 4);
    expect(large.exposure).toBeCloseTo(1 - EXPOSURE.maxDip, 6);
    expect(large.skyDim).toBeCloseTo(EXPOSURE.skyDimAtFull, 6);
  });
  it('damps toward the target without overshoot', () => {
    let x = 1;
    for (let i = 0; i < 120; i++) x = damp(x, 0.6, EXPOSURE.damping, 1 / 60);
    expect(x).toBeGreaterThan(0.6);
    expect(x).toBeLessThan(0.61);
  });
});

describe('god ray opacity', () => {
  it('is zero behind the camera and the visible fraction for a small Sun', () => {
    expect(godRayOpacity(1, false, 0.001)).toBe(0);
    expect(godRayOpacity(0.6, true, 0)).toBeCloseTo(0.6, 6);
  });
  it('backs off to the close-up floor for a large Sun', () => {
    expect(godRayOpacity(1, true, EXPOSURE.fullSizeRad)).toBeCloseTo(EXPOSURE.rayCloseUpOpacity, 6);
    expect(godRayOpacity(1, true, 1)).toBeCloseTo(EXPOSURE.rayCloseUpOpacity, 6);
    expect(godRayOpacity(0, true, 1)).toBe(0);
  });
});

describe('lens flare opacity', () => {
  it('inverts the weight, because the library fades the flare with mix(flare, 0, opacity)', () => {
    expect(flareOpacity(1)).toBe(0); // Sun fully visible in frame: full flare
    expect(flareOpacity(0)).toBe(1); // hidden or out of frame: no flare
    expect(flareOpacity(0.25)).toBeCloseTo(0.75, 12);
  });
});
