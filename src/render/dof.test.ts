import { describe, expect, it } from 'vitest';
import { dofSettings, focusPoint, LOG_DEPTH_COC_FRAGMENT, patchCocForLogDepth } from './dof';

describe('depth of field', () => {
  it('keeps the selected body sharp with a range proportional to distance', () => {
    expect(dofSettings(100000, 'full')).toEqual({ focusRange: 35000, bokehScale: 2 });
    expect(dofSettings(100000, 'light')).toEqual({ focusRange: 60000, bokehScale: 1 });
  });
  it('focuses on the near surface, not the centre', () => {
    const p = focusPoint([0, 0, -10000], 2000);
    expect(p[2]).toBeCloseTo(-8000, 9);
  });
});

describe('log-depth circle of confusion', () => {
  it('replaces the stock shader once', () => {
    const m = { fragmentShader: 'stock', needsUpdate: false };
    patchCocForLogDepth(m);
    expect(m.fragmentShader).toBe(LOG_DEPTH_COC_FRAGMENT);
    expect(m.needsUpdate).toBe(true);
    m.needsUpdate = false;
    patchCocForLogDepth(m);
    expect(m.needsUpdate).toBe(false);
  });
});
