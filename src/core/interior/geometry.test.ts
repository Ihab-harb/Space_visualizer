import { describe, expect, it } from 'vitest';
import type { InteriorLayer } from '../details/schema';
import { drawnLayers, explodeOffsets, sectionVisible } from './geometry';

const src = { sourceId: 's', from: 'radius' as const };
const r = (min: number, max = min) => ({ min, max, ...src });
const layer = (id: string, o?: [number, number?], i?: [number, number?], extra: Record<string, unknown> = {}): InteriorLayer =>
  ({
    id, name: id, from: 'radius', state: 'solid', composition: null, uncertain: false,
    ...(o ? { outerRadiusKm: r(o[0], o[1]) } : {}),
    ...(i ? { innerRadiusKm: r(i[0], i[1]) } : {}),
    ...extra,
  }) as unknown as InteriorLayer;
const illus = (id: string) => layer(id, undefined, undefined, { sizeKind: 'illustrative' });

describe('drawnLayers', () => {
  const earth = [
    layer('crust', [6371], [6341]),
    layer('mantle', [6341], [3485]),
    layer('outer-core', [3485], [1221]),
    layer('inner-core', [1221], [0]),
  ];
  it('Earth: four layers, thin crust thickened, mantle inner from the data', () => {
    const d = drawnLayers(earth, 6371);
    expect(d).toHaveLength(4);
    expect(d[0]!.thickened).toBe(true);
    expect(d[0]!.outer - d[0]!.inner).toBeGreaterThanOrEqual(0.012 - 1e-12);
    expect(d[1]!.inner).toBeCloseTo(3485 / 6371, 10);
    expect(d[1]!.thickened).toBe(false);
    expect(d[3]!.inner).toBe(0);
    expect(d[0]!.sizeKind).toBe('cited');
  });
  it('a range bound draws at the midpoint with a band of width/radius', () => {
    const d = drawnLayers([layer('a', [10], [3, 5]), layer('b', [3, 5], [0])], 10);
    expect(d[0]!.inner).toBeCloseTo(0.4);
    expect(d[0]!.innerBand).toBeCloseTo(0.2);
    expect(d[0]!.outerBand).toBe(0);
    expect(d[1]!.outer).toBeCloseTo(0.4);
    expect(d[1]!.outerBand).toBeCloseTo(0.2);
  });
  it('illustrative layers share the room between cited neighbours', () => {
    const d = drawnLayers([layer('a', [10], [8]), illus('x'), illus('y')], 10);
    expect(d[1]!.outer).toBeCloseTo(0.8);
    expect(d[1]!.inner).toBeCloseTo(0.4);
    expect(d[2]!.outer).toBeCloseTo(0.4);
    expect(d[2]!.inner).toBe(0);
    expect(d[1]!.sizeKind).toBe('illustrative');
    expect(d[1]!.innerBand).toBe(0);
  });
  it('carries the estimate size kind and the state', () => {
    const d = drawnLayers([layer('a', [10], [0], { sizeKind: 'estimate', estimate: true, state: 'liquid' })], 10);
    expect(d[0]!.sizeKind).toBe('estimate');
    expect(d[0]!.state).toBe('liquid');
  });
  it('never yields NaN or inverted layers', () => {
    const cases: [InteriorLayer[], number][] = [
      [earth, 6371],
      [[illus('a')], 100],
      [[illus('a'), illus('b'), illus('c')], 1],
      [[layer('a', [100], [99.9]), layer('b', [99.9], [99.8]), layer('c', [99.8], [99.7]), layer('d', [99.7], [0])], 100],
      [[layer('a', [100], [0.001]), layer('b', [0.001], [0.0005]), layer('c', [0.0005], [0])], 100],
      [[layer('a', [10], [4, 6]), layer('b', [4, 6], [0])], 10],
      [[layer('a', [200], [50])], 100],
    ];
    for (const [ls, rad] of cases) {
      const d = drawnLayers(ls, rad);
      d.forEach((l, i) => {
        for (const v of [l.outer, l.inner, l.outerBand, l.innerBand]) expect(Number.isFinite(v)).toBe(true);
        expect(l.outer).toBeGreaterThan(l.inner);
        expect(l.inner).toBeGreaterThanOrEqual(0);
        expect(l.outer).toBeLessThanOrEqual(1);
        if (i > 0) expect(l.outer).toBeLessThanOrEqual(d[i - 1]!.inner + 1e-12);
      });
    }
  });
  it('returns [] for no layers or a bad radius', () => {
    expect(drawnLayers([], 10)).toEqual([]);
    expect(drawnLayers(earth, 0)).toEqual([]);
  });
});

describe('explodeOffsets', () => {
  const d = drawnLayers([layer('a', [10], [6]), layer('b', [6], [3]), layer('c', [3], [0])], 10);
  it('is zero at progress 0', () => expect(explodeOffsets(d, 0)).toEqual([0, 0, 0]));
  it('lifts the outermost most at progress 1', () => {
    const o = explodeOffsets(d, 1);
    expect(o[0]!).toBeGreaterThan(o[1]!);
    expect(o[1]!).toBeGreaterThan(o[2]!);
    expect(o.every(Number.isFinite)).toBe(true);
  });
  it('clamps progress', () => expect(explodeOffsets(d, 5)).toEqual(explodeOffsets(d, 1)));
});

describe('sectionVisible', () => {
  it('whole: no cut, no explode', () => expect(sectionVisible('whole', 1)).toEqual({ cut: false, explode: 0 }));
  it('exploded: explode follows progress, no cut', () => expect(sectionVisible('exploded', 0.5)).toEqual({ cut: false, explode: 0.5 }));
  it('section: cut once progress starts, no explode', () => {
    expect(sectionVisible('section', 0)).toEqual({ cut: false, explode: 0 });
    expect(sectionVisible('section', 0.7)).toEqual({ cut: true, explode: 0 });
  });
});
