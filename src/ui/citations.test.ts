import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { createCatalog } from '../core/catalog/catalog';
import { makeCatalogFiles, makeEarth } from '../test/fixtures';
import { makeJupiterDetails, makeMarsDetails } from '../test/detailsFixtures';
import { citationModel, citationOrder, detailsSourceOrder } from './citations';

describe('citationOrder', () => {
  it('puts imagery sources after the data sources, without duplicates', () => {
    const base = citationOrder(makeEarth());
    const earth: Body = {
      ...makeEarth(),
      imagery: {
        color: { tiers: { '2k': 'a' }, sourceId: 'nasa-blue-marble' },
        clouds: { tiers: { '2k': 'b' }, sourceId: 'nasa-blue-marble' },
        night: { tiers: { '2k': 'c' }, sourceId: 'nasa-black-marble' },
      },
    };
    expect(citationOrder(earth)).toEqual([...base, 'nasa-blue-marble', 'nasa-black-marble']);
  });
});

describe('citationModel', () => {
  it('numbers the live source after the body’s own sources, once', () => {
    const f = makeCatalogFiles();
    const catalog = createCatalog(f.regions, f.sources, [f.bodies]);
    const jupiter = catalog.bodyById.get('jupiter')!;
    const m = citationModel(catalog, jupiter);
    expect(m.order.slice(0, citationOrder(jupiter).length)).toEqual(citationOrder(jupiter));
    expect(new Set(m.order).size).toBe(m.order.length);
    expect(m.liveSource).toBe('jpl-approx-pos');
    expect(m.numbers.get(m.order[0]!)).toBe(1);
  });
});

describe('citationModel with details', () => {
  const f = makeCatalogFiles();
  const catalog = createCatalog(f.regions, f.sources, [f.bodies]);
  it('only appends: numbers shown before the details load never change', () => {
    const jupiter = catalog.bodyById.get('jupiter')!;
    const before = citationModel(catalog, jupiter);
    const after = citationModel(catalog, jupiter, makeJupiterDetails());
    for (const [id, n] of before.numbers) expect(after.numbers.get(id)).toBe(n);
    const added = after.order.filter((id) => !before.order.includes(id));
    for (const id of added) expect(after.numbers.get(id)!).toBeGreaterThan(before.order.length);
    expect(new Set(after.order).size).toBe(after.order.length);
  });
  it('appends Mars details sources even when the body has none of them, without duplicates', () => {
    const mars = { ...catalog.bodyById.get('jupiter')!, id: 'mars', name: 'Mars' };
    const before = citationModel(catalog, mars);
    const after = citationModel(catalog, mars, makeMarsDetails());
    for (const [id, n] of before.numbers) expect(after.numbers.get(id)).toBe(n);
    expect(new Set(after.order).size).toBe(after.order.length);
  });
  it('lists details sources in display order', () => {
    expect(detailsSourceOrder(makeJupiterDetails())).toEqual(['nssdca-planetary-fact-sheet', 'nasa-science-jupiter']);
    expect(detailsSourceOrder(null)).toEqual([]);
  });
  it('lists a layer state source right after the layer bounds', () => {
    const d = makeMarsDetails();
    d.interior!.layers[2]!.stateSourceId = 'insight-page';
    const order = detailsSourceOrder(d);
    expect(order).toContain('insight-page');
    expect(order.indexOf('insight-page')).toBe(order.indexOf('nssdca-planetary-fact-sheet') + 1);
  });
});
