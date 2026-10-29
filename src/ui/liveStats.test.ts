import { describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { makeCatalogFiles, makeMoon, makeMoonTable } from '../test/fixtures';
import { bodyState } from '../core/ephemeris/state';
import { systemState } from '../core/ephemeris/system';
import { distance } from '../core/math/vec3';
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

describe('liveStats for the Moon', () => {
  const mf = makeCatalogFiles();
  mf.bodies.bodies.push(makeMoon());
  const moonCatalog = createCatalog(mf.regions, mf.sources, [mf.bodies], new Map([['moon', makeMoonTable()]]));
  it("gives the Moon's distance from Earth near 384,400 km, and from its parent", () => {
    const s = liveStats(moonCatalog, moonCatalog.bodyById.get('moon')!, 2451545 + 3);
    expect(s.fromEarthKm!).toBeGreaterThan(356000);
    expect(s.fromEarthKm!).toBeLessThan(407000);
    expect(s.fromParentKm).toBeCloseTo(s.fromEarthKm!, 6);
    expect(s.sourceId).toBe('jpl-horizons');
  });
  it('has no parent distance for a planet whose parent is the Sun', () => {
    expect(liveStats(moonCatalog, moonCatalog.bodyById.get('jupiter')!, 2451545).fromParentKm).toBeNull();
  });
  it('measures Earth from the Sun using the Earth that is off the barycentre', () => {
    const e = liveStats(moonCatalog, moonCatalog.bodyById.get('earth')!, 2451545 + 3);
    expect(e.fromSunKm).not.toBeNull();
    const jd = 2451545 + 3;
    const states = systemState(moonCatalog.bodies, moonCatalog.ephemerisTables, jd);
    const emb = bodyState(moonCatalog.bodyById.get('earth')!, jd).positionKm;
    const offset = distance(emb, states.get('earth')!.positionKm);
    const moon = moonCatalog.bodyById.get('moon')!;
    const r = distance(states.get('moon')!.positionKm, states.get('earth')!.positionKm);
    const mu = Number((moon.orbit as { barycentre: { massRatio: { value: number } } }).barycentre.massRatio.value);
    expect(Math.abs(offset - mu * r) / (mu * r)).toBeLessThan(1e-6);
  });
});
