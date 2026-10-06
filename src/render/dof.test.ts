import { describe, expect, it, vi } from 'vitest';
import { cocMagnitude, DOF_BOKEH, DOF_FOCUS_PLATEAU, DOF_RADIUS_RANGE, dofSettings, focusPoint, LOG_DEPTH_COC_FRAGMENT, patchCocForLogDepth } from './dof';

describe('depth of field', () => {
  it('keeps the selected body sharp with a range proportional to distance and a mild bokeh', () => {
    expect(DOF_BOKEH).toEqual({ full: 1, light: 0.6 });
    expect(dofSettings(100000, 'full')).toEqual({ focusRange: 35000, bokehScale: 1 });
    expect(dofSettings(100000, 'light')).toEqual({ focusRange: 60000, bokehScale: 0.6 });
  });
  it('has an in-focus plateau: no blur within DOF_FOCUS_PLATEAU of the range, full blur beyond the range', () => {
    expect(DOF_FOCUS_PLATEAU).toBe(0.25);
    expect(cocMagnitude(0, 1000)).toBe(0);
    expect(cocMagnitude(250, 1000)).toBe(0);
    expect(cocMagnitude(-250, 1000)).toBe(0);
    expect(cocMagnitude(625, 1000)).toBeCloseTo(0.5, 9);
    expect(cocMagnitude(1000, 1000)).toBe(1);
    expect(cocMagnitude(5000, 1000)).toBe(1);
    expect(LOG_DEPTH_COC_FRAGMENT).toContain(`smoothstep(${DOF_FOCUS_PLATEAU.toFixed(4)} * range, range, abs(signedDistance))`);
  });
  it('widens the range by the body radius so the far side of a large body stays sharp', () => {
    expect(DOF_RADIUS_RANGE).toBeGreaterThan(1);
    expect(dofSettings(100000, 'full', 2000).focusRange).toBeCloseTo(35000 + DOF_RADIUS_RANGE * 2000, 9);
    expect(dofSettings(100000, 'light', 2000).focusRange).toBeCloseTo(60000 + DOF_RADIUS_RANGE * 2000, 9);
  });
  it('focuses on the near surface, not the centre', () => {
    const p = focusPoint([0, 0, -10000], 2000);
    expect(p[2]).toBeCloseTo(-8000, 9);
  });
});

describe('log-depth circle of confusion', () => {
  const good = () => ({
    fragmentShader: 'stock',
    needsUpdate: false,
    defines: { PERSPECTIVE_CAMERA: true, LOG_DEPTH: '1' } as Record<string, unknown>,
    uniforms: { depthBuffer: {}, projectionMatrixInverse: {}, cameraFar: {}, focusDistance: {}, focusRange: {} } as Record<string, unknown>,
  });
  it('replaces the stock shader once', () => {
    const m = good();
    expect(patchCocForLogDepth(m)).toBe('patched');
    expect(m.fragmentShader).toBe(LOG_DEPTH_COC_FRAGMENT);
    expect(m.needsUpdate).toBe(true);
    m.needsUpdate = false;
    expect(patchCocForLogDepth(m)).toBe('patched');
    expect(m.needsUpdate).toBe(false);
  });
  it('waits for the library to set LOG_DEPTH', () => {
    const m = good();
    delete m.defines.LOG_DEPTH;
    expect(patchCocForLogDepth(m)).toBe('pending');
    expect(m.fragmentShader).toBe('stock');
  });
  it('reports and leaves the material alone when the library changed', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const mutations = [
      (m: ReturnType<typeof good>) => delete m.defines.PERSPECTIVE_CAMERA,
      (m: ReturnType<typeof good>) => (m.defines.USE_REVERSED_DEPTH_BUFFER = '1'),
      (m: ReturnType<typeof good>) => delete m.uniforms.focusDistance,
    ];
    for (const mutate of mutations) {
      const m = good();
      mutate(m);
      expect(patchCocForLogDepth(m)).toBe('failed');
      expect(m.fragmentShader).toBe('stock');
    }
    expect(err).toHaveBeenCalledTimes(3);
    err.mockRestore();
  });
});
