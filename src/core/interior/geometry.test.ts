import { describe, expect, it } from 'vitest';
import type { InteriorLayer } from '../details/schema';
import { drawnLayers, EXPLODE_MARGIN, EXPLODE_MAX, EXPLODE_REVEAL, explodeOffsets, sectionVisible } from './geometry';

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
  it('clamps a band to the drawn layer thickness', () => {
    const d = drawnLayers([layer('a', [10], [4, 6]), layer('b', [4, 6], [0])], 10, { minThickness: 0 });
    const t = (l: (typeof d)[number]) => l.outer - l.inner;
    const wide = drawnLayers([layer('a', [10], [9.9, 10.1 - 0.5]), layer('b', [9.9, 9.6], [0])], 10);
    for (const l of [...d, ...wide]) {
      expect(l.outerBand).toBeLessThanOrEqual(t(l) + 1e-12);
      expect(l.innerBand).toBeLessThanOrEqual(t(l) + 1e-12);
    }
    const thin = drawnLayers([layer('a', [10], [0, 10])], 10);
    expect(thin[0]!.innerBand).toBeLessThanOrEqual(thin[0]!.outer - thin[0]!.inner);
    expect(thin[0]!.innerBand).toBeCloseTo(0.5, 1);
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
  it('each cap clears the dome below it: the innermost sphere whole, other domes by EXPLODE_REVEAL of their height', () => {
    // Outer radii 1, 0.6, 0.3 (Task 8: was a flat 0.3 step, which hid most of each dome inside the cap above).
    const o = explodeOffsets(d, 1);
    expect(o[2]!).toBe(0);
    expect(o[1]!).toBeCloseTo(0.3 + EXPLODE_MARGIN, 10);
    expect(o[0]! - o[1]!).toBeCloseTo(0.6 * EXPLODE_REVEAL + EXPLODE_MARGIN, 10);
  });
  it("Earth's stack shows each dome mostly whole, below the lift cap", () => {
    const earth = drawnLayers(
      [layer('crust', [6371], [6341]), layer('mantle', [6341], [3485]), layer('outer-core', [3485], [1221]), layer('inner-core', [1221], [0])],
      6371,
    );
    const o = explodeOffsets(earth, 1);
    // The visible part of dome i is the gap up to the base of the cap above it.
    for (let i = 1; i < earth.length - 1; i++) expect((o[i - 1]! - o[i]!) / earth[i]!.outer).toBeGreaterThanOrEqual(0.75);
    expect(o[2]!).toBeGreaterThan(earth[3]!.outer); // the inner core sits clear below the outer core's cap
    expect(o[0]!).toBeLessThanOrEqual(EXPLODE_MAX);
    expect(o[0]!).toBeGreaterThan(1.4); // well apart, as in mockup B
  });
  it(`6 layers top out at EXPLODE_MAX (${EXPLODE_MAX}) or less, still in order`, () => {
    const six = Array.from({ length: 6 }, (_, i) => layer(`l${i}`, [10 - i], [9 - i]));
    const o = explodeOffsets(drawnLayers(six, 10), 1);
    expect(Math.max(...o)).toBeLessThanOrEqual(EXPLODE_MAX + 1e-12);
    expect(o[0]!).toBeCloseTo(EXPLODE_MAX, 10);
    for (let i = 1; i < o.length; i++) expect(o[i - 1]!).toBeGreaterThan(o[i]!);
  });
  it('scales with progress', () => {
    const half = explodeOffsets(d, 0.5);
    explodeOffsets(d, 1).forEach((v, i) => expect(half[i]!).toBeCloseTo(v / 2, 12));
  });
  it('one layer and none', () => {
    expect(explodeOffsets(d.slice(0, 1), 1)).toEqual([0]);
    expect(explodeOffsets([], 1)).toEqual([]);
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
