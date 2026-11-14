import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RAD } from '../../src/core/math/angles';
import { angleBetween } from '../../src/core/math/vec3';
import { orbitNormal } from '../../src/core/ephemeris/conic';
import { elementsAt } from '../../src/core/ephemeris/planetApprox';
import { poleEcliptic } from '../../src/core/frames/rotation';
import type { ImageryFile } from '../../src/core/catalog/schema';
import type { FetchedText } from '../lib/fetchCached';
import { DESCRIPTION_PAGES } from '../sources/nasaScience';
import type { HorizonsReference } from '../sources/horizons';
import { buildSolarSystem } from './buildSolarSystem';
import { validateOutput } from './validate';

const fixture = (name: string): FetchedText => ({ text: readFileSync(`pipeline/fixtures/${name}`, 'utf8'), retrievedAt: '2026-10-04', fromCache: true });
const descriptions = Object.fromEntries(
  Object.keys(DESCRIPTION_PAGES).map((id) => [id, { text: `<meta name="description" content="Test description for ${id}.">`, retrievedAt: '2026-10-04', fromCache: true }]),
) as Record<keyof typeof DESCRIPTION_PAGES, FetchedText>;
const horizons = JSON.parse(readFileSync('pipeline/reference/horizons-heliocentric.json', 'utf8')) as HorizonsReference;
const imagery = JSON.parse(readFileSync('public/textures/imagery.json', 'utf8')) as ImageryFile;

const out = buildSolarSystem(
  { approxPos: fixture('approx_pos.html'), planetSheet: fixture('planet-factsheet.html'), sunSheet: fixture('sun-factsheet.html'), pck: fixture('pck00011.tpc'), descriptions, horizons, imagery },
  '2026-10-04T12:00:00.000Z',
);
const body = (id: string) => out.bodies.bodies.find((b) => b.id === id)!;

describe('buildSolarSystem', () => {
  it('produces valid, fully sourced output', () => {
    expect(validateOutput(out)).toEqual([]);
  });

  it('contains the Sun and the eight planets in order', () => {
    expect(out.bodies.bodies.map((b) => b.id)).toEqual(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  });

  it('maps Jupiter facts with SI units and sources, omitting unknown values', () => {
    const j = body('jupiter');
    expect(j.facts.massKg?.value).toBeCloseTo(1.898e27, -22);
    expect(j.facts.massKg?.sourceId).toBe('nssdca-planetary-fact-sheet');
    expect(j.facts.meanDistanceFromSunKm?.value).toBe(778.5e6);
    expect(j.facts.surfacePressureBar).toBeUndefined();
    expect(j.facts.semiMajorAxisAu).toMatchObject({ value: 5.202887, sourceId: 'jpl-approx-pos' });
    expect(j.shape).toEqual({ equatorialRadiusKm: 71492, polarRadiusKm: 66854, sourceId: 'naif-pck00011' });
    expect(j.description).toEqual({ text: 'Test description for jupiter.', sourceId: 'nasa-science-jupiter' });
  });

  it('maps the Sun from the Sun fact sheet', () => {
    const s = body('sun');
    expect(s.facts.massKg?.value).toBeCloseTo(1.9884e30, -25);
    expect(s.facts.spectralType?.value).toBe('G2 V');
    expect(s.orbit).toMatchObject({ type: 'fixed', positionKm: [0, 0, 0] });
  });

  it('marks Earth as the Earth-Moon barycentre and uses calendar-derived table ranges', () => {
    const orbit = body('earth').orbit;
    if (orbit.type !== 'planet-approx') throw new Error('expected planet-approx');
    expect(orbit.represents).toBe('earth-moon-barycenter');
    expect(orbit.tables.map((t) => [t.id, t.validFromJdTdb, t.validToJdTdb])).toEqual([
      ['1800-2050', 2378496.5, 2470172.5],
      ['3000BC-3000AD', 625673.5, 2817152.5],
    ]);
  });

  it('records the error measured against Horizons, showing Neptune exceeds the JPL nominal', () => {
    const orbit = body('neptune').orbit;
    if (orbit.type !== 'planet-approx') throw new Error('expected planet-approx');
    const t1 = orbit.tables[0]!;
    expect(t1.horizonsCheck?.sampleCount).toBe(6);
    expect(t1.horizonsCheck?.sourceId).toBe('jpl-horizons');
    expect(t1.horizonsCheck!.maxDistanceErrorKm).toBeGreaterThan(t1.nominalError.distanceKm);
    expect(orbit.tables[1]!.horizonsCheck?.sampleCount).toBe(3);
  });

  it('agrees with NSSDCA obliquity within 0.15 deg (IAU poles; retrograde rotators measured from the IAU north pole)', () => {
    for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      const b = body(id);
      if (b.orbit.type !== 'planet-approx' || !b.rotation) throw new Error(id);
      const angle = angleBetween(poleEcliptic(b.rotation, 2451545.0), orbitNormal(elementsAt(b.orbit.tables[0]!, 2451545.0))) * RAD;
      const obliquity = b.facts.obliquityDeg!.value as number;
      const expected = obliquity > 90 ? 180 - obliquity : obliquity;
      expect(Math.abs(angle - expected), id).toBeLessThanOrEqual(0.15);
    }
  });

  it('attaches official imagery to planets and cites every image', () => {
    expect(body('earth').imagery?.color?.sourceId).toBe('nasa-blue-marble-ng');
    expect(body('saturn').imagery?.rings?.innerKm.value).toBeGreaterThan(70000);
    expect(body('venus').imagery).toBeNull();
    expect(out.sources.sources.map((s) => s.id)).toEqual(expect.arrayContaining(['stsci-opal', 'nssdca-saturn-rings', 'nasa-svs-deep-star-maps']));
    expect(validateOutput(out)).toEqual([]);
  });

  it('fails validation when a referenced source is missing', () => {
    const broken = structuredClone(out);
    broken.sources.sources = broken.sources.sources.filter((s) => s.id !== 'naif-pck00011');
    expect(validateOutput(broken).some((e) => e.includes('unknown sourceId "naif-pck00011"'))).toBe(true);
  });
});
