import { describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { makeCatalogFiles, makeMoon } from '../test/fixtures';
import { accuracyLines } from './accuracy';

const f = makeCatalogFiles();
f.bodies.bodies.push(makeMoon());
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);
const moon = catalog.bodyById.get('moon')!;
const earth = catalog.bodyById.get('earth')!;

describe('accuracyLines for the Moon', () => {
  const lines = accuracyLines(moon, catalog);
  it('cites Horizons for the table and jpl-sats-elem for the mean elements', () => {
    expect(lines[0]!.text).toContain('JPL Horizons, compressed to Chebyshev polynomials');
    expect(lines[0]!.text).toContain("as seen from Earth's centre");
    expect(lines[0]!.sourceIds).toEqual(['jpl-horizons']);
    expect(lines[1]!.text).toMatch(/^Other dates: JPL mean elements\./);
    expect(lines[1]!.sourceIds).toEqual(['jpl-sats-elem']);
  });
  it('ends with the mean-elements note', () => {
    expect(lines[2]!.text).toBe(moon.orbit.type === 'satellite' ? moon.orbit.meanElements.note : '');
  });
  it('states a large mean-elements error in degrees', () => {
    const m = structuredClone(moon);
    if (m.orbit.type !== 'satellite') throw new Error('fixture');
    m.orbit.meanElements.horizonsCheck = { sampleCount: 3, maxAngularErrorArcsec: 631297, maxDistanceErrorKm: 784535, sourceId: 'jpl-horizons' };
    const l = accuracyLines(m, catalog)[1]!;
    expect(l.text).toContain('up to 175°');
    expect(l.text).toContain('784,535 km');
    expect(l.sourceIds).toEqual(['jpl-sats-elem', 'jpl-horizons']);
  });
});

describe('accuracyLines for Earth', () => {
  it('no longer says the Moon arrives later, and explains the barycentre offset with mu', () => {
    const text = accuracyLines(earth, catalog).map((l) => l.text).join(' ');
    expect(text).not.toContain('arrives in a later release');
    expect(text).toContain("Earth is drawn at its own centre: the barycentre position minus the Moon's share (μ = 0.01215)");
    expect(text).toContain("The orbit line shows the Earth–Moon barycentre's path.");
  });
});
