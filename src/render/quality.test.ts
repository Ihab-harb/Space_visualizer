import { describe, expect, it } from 'vitest';
import { activePasses, initialLevel, nextMode, parseQualityMode, canvasDpr, pixelRatioFor, PRESETS, stepDown, stepUp } from './quality';

describe('quality presets (spec §5)', () => {
  it('match the spec table', () => {
    expect(PRESETS.high).toMatchObject({ maxPixelRatio: 2, sphereSegments: [192, 96], maxTier: '8k', atmosphereSamples: 16, bloomLevels: 8, detailFx: 'full', sunRays: true });
    expect(PRESETS.medium).toMatchObject({ maxPixelRatio: 1.25, sphereSegments: [96, 48], maxTier: '2k', atmosphereSamples: 8, bloomLevels: 5, detailFx: 'light', sunRays: true });
    expect(PRESETS.low).toMatchObject({ maxPixelRatio: 1, sphereSegments: [48, 24], maxTier: '1k', atmosphereSamples: 4, bloomLevels: 3, detailFx: 'off', sunRays: false });
  });
  it('never renders above the device pixel ratio', () => {
    expect(pixelRatioFor('high', 3)).toBe(2);
    expect(pixelRatioFor('high', 1)).toBe(1);
    expect(pixelRatioFor('medium', 2)).toBe(1.25);
    expect(pixelRatioFor('medium', 1)).toBe(1);
    expect(pixelRatioFor('low', 2)).toBe(1);
  });
  it('starts phones at Low and everything else at High', () => {
    expect(initialLevel({ coarsePointer: true, viewportWidth: 390 })).toBe('low');
    expect(initialLevel({ coarsePointer: true, viewportWidth: 1366 })).toBe('high');
    expect(initialLevel({ coarsePointer: false, viewportWidth: 390 })).toBe('high');
  });
  it('cycles modes and steps levels within bounds', () => {
    expect([nextMode('auto'), nextMode('high'), nextMode('medium'), nextMode('low')]).toEqual(['high', 'medium', 'low', 'auto']);
    expect([stepDown('high'), stepDown('medium'), stepDown('low')]).toEqual(['medium', 'low', 'low']);
    expect([stepUp('low'), stepUp('medium'), stepUp('high')]).toEqual(['medium', 'high', 'high']);
  });
  it('parses quality modes from text', () => {
    expect(parseQualityMode('medium')).toBe('medium');
    expect(parseQualityMode('ultra')).toBeUndefined();
    expect(parseQualityMode(null)).toBeUndefined();
  });
});

describe('canvasDpr (Canvas dpr prop)', () => {
  it('is a single number per level, never a range', () => {
    expect(canvasDpr('low', 2)).toBe(1);
    expect(canvasDpr('medium', 2)).toBe(1.25);
    expect(canvasDpr('high', 3)).toBe(2);
    expect(typeof canvasDpr('high', 2)).toBe('number');
  });
  it('falls back to 1 for a missing or invalid devicePixelRatio', () => {
    expect(canvasDpr('high', undefined)).toBe(1);
    expect(canvasDpr('high', 0)).toBe(1);
    expect(canvasDpr('high', Number.NaN)).toBe(1);
  });
});

describe('activePasses', () => {
  it('keeps only bloom and a neutral tone map when camera effects are off', () => {
    expect(activePasses('high', false)).toEqual(['bloom', 'tonemap']);
  });
  it('orders the full stack at High', () => {
    expect(activePasses('high', true)).toEqual(['bloom', 'rays', 'flare', 'streaks', 'dof', 'exposure', 'tonemap', 'chromatic', 'vignette', 'grain']);
  });
  it('keeps depth of field mounted at Medium too (neutral without a selection, so selecting never rebuilds the composer)', () => {
    expect(activePasses('medium', true)).toContain('dof');
    expect(activePasses.length).toBe(2); // the selection is not an input
  });
  it('drops the detail effects and sun rays at Low', () => {
    expect(activePasses('low', true)).toEqual(['bloom', 'exposure', 'tonemap', 'vignette']);
  });
});
