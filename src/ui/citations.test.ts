import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { createCatalog } from '../core/catalog/catalog';
import { makeCatalogFiles, makeEarth } from '../test/fixtures';
import { citationModel, citationOrder } from './citations';

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
