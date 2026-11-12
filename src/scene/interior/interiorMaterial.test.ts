import { describe, expect, it } from 'vitest';
import { createInteriorMaterial, createSharedUniforms, INTERIOR_LOOK } from './interiorMaterial';

describe('interior materials', () => {
  it('bound the saturation push below zero at a small fraction of the luma (amber needs a little negative blue under AgX)', () => {
    expect(INTERIOR_LOOK.negativeFloor).toBeGreaterThan(0);
    expect(INTERIOR_LOOK.negativeFloor).toBeLessThanOrEqual(0.25);
    const shared = createSharedUniforms();
    for (const part of ['face', 'shell', 'hollow'] as const) {
      const material = createInteriorMaterial(part, shared, 0);
      const src = material.fragmentShader.replace(/\s+/g, ' ');
      expect(src).toContain(`vec3 pushed = luma + (c - luma) * (1.0 + ${INTERIOR_LOOK.saturation.toFixed(3)} * clamp(glow, 0.0, 1.0));`);
      expect(src).toContain(`return max(pushed, vec3(-${INTERIOR_LOOK.negativeFloor.toFixed(3)}) * luma);`);
      material.dispose();
    }
  });
});
