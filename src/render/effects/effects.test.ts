import { describe, expect, it } from 'vitest';
import { ExposureEffect } from './ExposureEffect';

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
