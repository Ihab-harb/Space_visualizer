import { describe, expect, it } from 'vitest';
import { damp, EXPOSURE, sceneExposure, sunFrameWeight } from './exposure';

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
    const small = sceneExposure(1, 0.001);
    const large = sceneExposure(1, EXPOSURE.fullSizeRad);
    expect(small.exposure).toBeCloseTo(1 - EXPOSURE.minDip, 2);
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