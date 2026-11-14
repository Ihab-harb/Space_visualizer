import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { makeEarth } from '../test/fixtures';
import { citationOrder } from './citations';

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
