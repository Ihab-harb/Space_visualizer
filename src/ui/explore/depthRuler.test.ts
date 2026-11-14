import { describe, expect, it } from 'vitest';
import { drawnForDetails } from '../../scene/interior/useExploreTransition';
import { realCatalog, realDetails } from '../../test/realData';
import { depthRulerTicks, placeRuler } from './depthRuler';

const catalog = realCatalog();
const ticks = (bodyId: string) => {
  const body = catalog.bodyById.get(bodyId)!;
  const details = realDetails(bodyId);
  return depthRulerTicks(bodyId, details, drawnForDetails(body, details));
};
const short = (bodyId: string) => ticks(bodyId).map((t) => [t.kind, t.value, t.sourceId ?? null, t.estimate]);

describe('depthRulerTicks (Half-section depth ruler)', () => {
  it('Earth: surface, each cited boundary as depth in km, and the centre at the cited radius', () => {
    expect(short('earth')).toEqual([
      ['surface', '0 km', null, false],
      ['boundary', '30 km', 'nasa-science-earth', false],
      // Stated as a radius (3,485 km): depth = 6,371 - 3,485.
      ['boundary', '2,886 km', 'nssdca-earth-fact-sheet', false],
      ['boundary', '5,150 km', 'nasa-science-earth', false],
      ['centre', '6,371 km', 'nssdca-earth-fact-sheet', false],
    ]);
  });
  it('places each tick at its drawn radius, surface 1 down to centre 0, in order', () => {
    const t = ticks('earth');
    expect(t[0]!.r).toBe(1);
    expect(t.at(-1)!.r).toBe(0);
    for (let i = 1; i < t.length; i++) expect(t[i]!.r).toBeLessThan(t[i - 1]!.r);
  });
  it('a range stays a range (Mars crust 10-50 km; core radius 1,500-2,100 km)', () => {
    const t = short('mars');
    expect(t[1]).toEqual(['boundary', '10–50 km', 'nasa-science-mars-facts', false]);
    expect(t[2]).toEqual(['boundary', '1,560 km', 'nasa-insight-deep-interior', false]);
    expect(t[3]).toEqual(['centre', '3,389.5 km', 'nssdca-mars-fact-sheet', false]);
  });
  it('marks paper bounds as estimates; a percent bound becomes an approximate depth (Jupiter, Saturn, the Sun)', () => {
    // Jupiter: two illustrative boundaries (a tick, no number), then the dilute core at 63 % of 69,911 km.
    expect(short('jupiter')).toEqual([
      ['surface', '0 km', null, false],
      ['boundary', null, null, false],
      ['boundary', '≈ 25,900 km', 'paper-militzer-2022-jupiter-dilute-core', true],
      ['centre', '69,911 km', 'nssdca-jupiter-fact-sheet', false],
    ]);
    expect(short('saturn')[2]).toEqual(['boundary', '≈ 23,300 km', 'paper-mankovich-fuller-2021-saturn-core', true]);
    expect(short('sun').map((t) => t[1])).toEqual(['0 km', '200,000 km', '≈ 522,000 km', '695,700 km']);
  });
  it('Venus: the paper crust ("about 20 km") and the core range, both estimates', () => {
    expect(short('venus')).toEqual([
      ['surface', '0 km', null, false],
      ['boundary', '≈ 20 km', 'paper-maia-wieczorek-2022-venus-plateaus', true],
      ['boundary', '1,702–3,122 km', 'paper-shah-2022-venus-interior', true],
      ['centre', '6,051.8 km', 'nssdca-venus-fact-sheet', false],
    ]);
  });
  it('an all-illustrative interior: ticks with no numbers except the surface and the cited centre (Uranus)', () => {
    expect(short('uranus').map((t) => t[1])).toEqual(['0 km', null, null, '25,362 km']);
  });
  it('without a cited radius, depths that need it are left out', () => {
    const body = catalog.bodyById.get('earth')!;
    const details = realDetails('earth');
    const noRadius = { ...details, interior: { layers: details.interior!.layers } };
    const t = depthRulerTicks('earth', noRadius, drawnForDetails(body, noRadius)).map((x) => x.value);
    expect(t).toEqual(['0 km', '30 km', null, null, null]);
  });
  it('no interior, no ruler', () => {
    expect(depthRulerTicks('earth', { ...realDetails('earth'), interior: null }, [])).toEqual([]);
  });
});

describe('placeRuler (beside the cut face, clear of the interface)', () => {
  const vp = { width: 1280, height: 720 };
  const size = (w: number) => ({ width: w, height: 16 });
  // Earth-like: surface and crust ticks almost together, then the mantle, core and centre.
  const ys = [150, 152, 252, 332, 375];
  const sizes = [size(40), size(46), size(64), size(64), size(110)];
  const input = { x: 800, ys, sizes, title: { width: 40, height: 14 } };

  it('shows values beside their ticks, pushed apart where ticks crowd, and reports the rect it takes', () => {
    const p = placeRuler(input, vp, []);
    expect(p.mode).toBe('full');
    expect(p.valueYs[0]).toBe(150);
    expect(p.valueYs[1]! - p.valueYs[0]!).toBeGreaterThanOrEqual(16);
    expect(p.valueYs[2]).toBe(252);
    for (let i = 1; i < ys.length; i++) expect(p.valueYs[i]! - p.valueYs[i - 1]!).toBeGreaterThanOrEqual(16);
    expect(p.rect.left).toBeLessThanOrEqual(800);
    expect(p.rect.right).toBeGreaterThanOrEqual(800 + 110);
    expect(p.rect.top).toBeLessThanOrEqual(150 - 14);
    expect(p.rect.bottom).toBeGreaterThanOrEqual(375);
  });
  it('drops the values (ticks only) when they would cross a reserved part such as the layer card', () => {
    const card = { left: 860, top: 68, right: 1264, bottom: 560 };
    const p = placeRuler(input, vp, [card]);
    expect(p.mode).toBe('compact');
    expect(p.rect.right).toBeLessThan(card.left);
  });
  it('hides when even the bare scale would cross something, or it is off screen', () => {
    expect(placeRuler(input, vp, [{ left: 790, top: 200, right: 820, bottom: 220 }]).mode).toBe('hidden');
    expect(placeRuler({ ...input, x: 1300 }, vp, []).mode).toBe('hidden');
    expect(placeRuler({ ...input, ys: [Number.NaN, ...ys.slice(1)] }, vp, []).mode).toBe('hidden');
  });
  it('a tick with no value takes no room', () => {
    const p = placeRuler({ ...input, sizes: [size(40), size(0), size(64), size(64), size(110)] }, vp, []);
    expect(p.valueYs[2]).toBe(252);
  });
});
