import { describe, expect, it } from 'vitest';
import { ExposureEffect } from './ExposureEffect';
import { EffectAttribute } from 'postprocessing';
import { AnamorphicStreakEffect } from './AnamorphicStreakEffect';

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
  it('bounds each tap by maxExcess so a transient HDR spike cannot smear the frame', () => {
    const e = new AnamorphicStreakEffect({ maxExcess: 1.5 });
    expect(e.uniforms.get('maxExcess')!.value).toBe(1.5);
    expect(e.getFragmentShader()).toContain('min(e, maxExcess)');
    e.dispose();
  });
});
