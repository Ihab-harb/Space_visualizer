import { describe, expect, it } from 'vitest';
import type { Region } from '../catalog/schema';
import { regionOpacity, regionOriginInRootKm, regionVisibility } from './regionManager';

const region = (over: Partial<Region>): Region => ({
  id: 'solar-system', name: 'Solar System', parentId: null, frame: 'heliocentric-ecliptic-j2000', unit: 'km',
  originInParentKm: [0, 0, 0], activeRangeKm: [0, 1e13], dataManifest: 'x.json', ...over,
});

describe('regionOpacity', () => {
  it('is fully visible well inside the range and fades out over 0.3 dex at the edges', () => {
    const r = region({ activeRangeKm: [1e3, 1e13] });
    expect(regionOpacity(r, 1e9)).toBe(1);
    expect(regionOpacity(r, 1e13)).toBe(0);
    expect(regionOpacity(r, 1e13 / 10 ** 0.15)).toBeCloseTo(0.5, 9);
    expect(regionOpacity(r, 1e3)).toBe(0);
    expect(regionOpacity(r, 1e3 * 10 ** 0.15)).toBeCloseTo(0.5, 9);
  });
  it('has no lower fade when the range starts at zero, even at distance zero', () => {
    expect(regionOpacity(region({}), 0)).toBe(1);
  });
});

describe('region nesting', () => {
  it('sums origins up the parent chain', () => {
    const root = region({ id: 'galaxy', originInParentKm: [0, 0, 0] });
    const child = region({ id: 'solar-system', parentId: 'galaxy', originInParentKm: [10, 20, 30] });
    const byId = new Map([[root.id, root], [child.id, child]]);
    expect(regionOriginInRootKm(child, byId)).toEqual([10, 20, 30]);
    expect(regionVisibility([root, child], [10, 20, 30 + 1e9]).get('solar-system')).toBe(1);
  });
  it('throws on an unknown parent', () => {
    expect(() => regionOriginInRootKm(region({ parentId: 'nowhere' }), new Map())).toThrow(/unknown parent "nowhere"/);
  });
});
