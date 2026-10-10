import { describe, expect, it } from 'vitest';
import { ExposureEffect } from './ExposureEffect';
import { EffectAttribute } from 'postprocessing';
import { AnamorphicStreakEffect, streakTapOffsets } from './AnamorphicStreakEffect';

describe('ExposureEffect', () => {
  it('stores the exposure in a uniform', () => {
    const e = new ExposureEffect(0.5);
    expect(e.exposure).toBe(0.5);
    e.exposure = 0.8;
    expect(e.uniforms.get('exposure')!.value).toBe(0.8);
    expect(e.getFragmentShader()).toContain('mainImage');
    e.dispose();
  });
});

describe('AnamorphicStreakEffect', () => {
  it('is a convolution effect with tunable uniforms', () => {
    const e = new AnamorphicStreakEffect({ strength: 0.5 });
    expect(e.getAttributes() & EffectAttribute.CONVOLUTION).toBeTruthy();
    expect(e.uniforms.get('strength')!.value).toBe(0.5);
    expect(e.getFragmentShader()).toContain('inputBuffer');
    e.dispose();
  });
  it('bounds each tap by maxExcess and reads NaN as no excess', () => {
    const e = new AnamorphicStreakEffect({ maxExcess: 1.5 });
    expect(e.uniforms.get('maxExcess')!.value).toBe(1.5);
    expect(e.getFragmentShader()).toContain('e > 0.0 ? min(e, maxExcess) : 0.0');
    e.dispose();
  });
  it('samples every texel out to the reach: no gaps, so no repeated copies of a thin highlight', () => {
    for (const reach of [36, 60]) {
      const offsets = streakTapOffsets(reach);
      // Each off-centre tap sits between two texels; bilinear filtering averages that pair.
      const covered = new Set<number>([0]);
      for (const d of offsets) {
        expect(d - Math.floor(d)).toBeCloseTo(0.5, 9);
        covered.add(Math.floor(d));
        covered.add(Math.ceil(d));
      }
      expect([...covered].sort((a, b) => a - b)).toEqual(Array.from({ length: reach + 1 }, (_, i) => i));
      for (let i = 1; i < offsets.length; i++) expect(offsets[i]! - offsets[i - 1]!).toBeLessThanOrEqual(2);
    }
    const e = new AnamorphicStreakEffect({ reachPx: 60 });
    expect(e.defines.get('STREAK_PAIRS')).toBe('30');
    expect(e.getFragmentShader()).not.toContain('gl_FragCoord'); // no per-pixel jitter
    e.dispose();
  });
});
