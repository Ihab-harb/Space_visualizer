import { describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { makeCatalogFiles } from '../test/fixtures';
import { liveStats } from './liveStats';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);

describe('liveStats', () => {
  it('gives distances from the Sun and Earth plus light time, cited to the position model', () => {
    const s = liveStats(catalog, catalog.bodyById.get('jupiter')!, 2451545);
    expect(s.fromSunKm).toBeGreaterThan(7e8);
    expect(s.fromEarthKm).toBeGreaterThan(5e8);
    expect(s.lightTimeS).toBeCloseTo(s.fromEarthKm! / 299792.458, 6);
    expect(s.sourceId).toBe('jpl-approx-pos');
  });
  it('has no distance to itself and cites Earth’s model for the fixed Sun', () => {
    expect(liveStats(catalog, catalog.bodyById.get('earth')!, 2451545).fromEarthKm).toBeNull();
    const sun = liveStats(catalog, catalog.bodyById.get('sun')!, 2451545);
    expect(sun.fromSunKm).toBeNull();
    expect(sun.sourceId).toBe('jpl-approx-pos');
  });
});
