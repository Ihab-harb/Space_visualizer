import { describe, expect, it } from 'vitest';
import { MAX_INTERIOR_LAYERS } from '../../core/details/checks';
import type { InteriorLayer } from '../../core/details/schema';
import { drawnLayers, GRADUAL_BAND } from '../../core/interior/geometry';
import { createInteriorMaterial, createSharedUniforms, INTERIOR_LOOK, MAX_LAYERS, writeLayerTable } from './interiorMaterial';

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
  it('a gradual boundary (Jupiter dilute core) gets a soft band on both sides, so no boundary line is drawn there', () => {
    const shared = createSharedUniforms();
    const layers = [illus('envelope'), illus('metallic'), { ...illus('core'), outerRadiusKm: r(63), innerRadiusKm: r(0), sizeKind: 'estimate', estimate: true, gradual: { sourceId: 's' } }] as unknown as InteriorLayer[];
    writeLayerTable(shared, drawnLayers(layers, 100), 'gas-giant');
    expect(shared.uBandTop!.value[2]).toBeCloseTo(GRADUAL_BAND, 10);
    expect(shared.uBandBottom!.value[1]).toBeCloseTo(GRADUAL_BAND, 10);
    const face = createInteriorMaterial('face', shared, 0).fragmentShader.replace(/\s+/g, ' ');
    // Lines and the shading step only at sharp boundaries; a band boundary blends.
    expect(face).toContain('if (uBandTop[i] <= 0.0) line = max(line');
    expect(face).toContain('if (uBandTop[i] > 0.0) continue; float d = uOuter[i] - r;');
    // The dome of a banded layer softens toward the layer above at its limb, and the hollow above toward the layer below.
    const shell = createInteriorMaterial('shell', shared, 2).fragmentShader.replace(/\s+/g, ' ');
    expect(shell).toContain('uBandTop[uLayer] > 0.0');
    const hollow = createInteriorMaterial('hollow', shared, 1).fragmentShader.replace(/\s+/g, ' ');
    expect(hollow).toContain('uBandBottom[uLayer] > 0.0');
  });
  it('holds as many layers as the details check allows', () => expect(MAX_LAYERS).toBe(MAX_INTERIOR_LAYERS));
});

const r = (v: number) => ({ min: v, max: v, sourceId: 's', from: 'percent', stated: { min: v, max: v } });
const illus = (id: string) => ({ id, name: id, from: 'percent', sizeKind: 'illustrative', state: 'unknown', composition: null, uncertain: false });
