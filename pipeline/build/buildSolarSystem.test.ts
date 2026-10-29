import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RAD } from '../../src/core/math/angles';
import { angleBetween } from '../../src/core/math/vec3';
import { orbitNormal } from '../../src/core/ephemeris/conic';
import { elementsAt } from '../../src/core/ephemeris/planetApprox';
import { poleEcliptic } from '../../src/core/frames/rotation';
import type { ChebyshevFile, ImageryFile } from '../../src/core/catalog/schema';
import { chebyshevRange } from '../../src/core/ephemeris/chebyshev';
import type { FetchedText } from '../lib/fetchCached';
import { DESCRIPTION_PAGES } from '../sources/nasaScience';
import type { HorizonsMoonCheck, HorizonsReference } from '../sources/horizons';
import { buildSolarSystem } from './buildSolarSystem';
import { validateOutput } from './validate';

const fixture = (name: string): FetchedText => ({ text: readFileSync(`pipeline/fixtures/${name}`, 'utf8'), retrievedAt: '2026-10-04', fromCache: true });
const descriptions = Object.fromEntries(
  Object.keys(DESCRIPTION_PAGES).map((id) => [id, { text: `<meta name="description" content="Test description for ${id}.">`, retrievedAt: '2026-10-04', fromCache: true }]),
) as Record<keyof typeof DESCRIPTION_PAGES, FetchedText>;
const horizons = JSON.parse(readFileSync('pipeline/reference/horizons-heliocentric.json', 'utf8')) as HorizonsReference;
const moonTable = JSON.parse(readFileSync('public/data/solar-system/ephemeris/moon.json', 'utf8')) as ChebyshevFile;
const moonCheck = JSON.parse(readFileSync('pipeline/reference/horizons-moon-check.json', 'utf8')) as HorizonsMoonCheck;
const ephemeris = new Map<string, unknown>([['solar-system/ephemeris/moon.json', moonTable]]);
const imagery = JSON.parse(readFileSync('public/textures/imagery.json', 'utf8')) as ImageryFile;

const out = buildSolarSystem(
  { approxPos: fixture('approx_pos.html'), planetSheet: fixture('planet-factsheet.html'), sunSheet: fixture('sun-factsheet.html'), pck: fixture('pck00011.tpc'), gmKernel: fixture('gm_de440.tpc'), moonSheet: fixture('moonfact.html'), satElemPage: fixture('jpl-sat-elem-moon.html'), moonTable, moonCheck, descriptions, horizons, imagery },
  '2026-10-04T12:00:00.000Z',
);
const body = (id: string) => out.bodies.bodies.find((b) => b.id === id)!;

describe('buildSolarSystem', () => {
  it('produces valid, fully sourced output', () => {
    expect(validateOutput(out, ephemeris)).toEqual([]);
  });

  it('contains the Sun, the eight planets and the Moon in order', () => {
    expect(out.bodies.bodies.map((b) => b.id)).toEqual(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon']);
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
    expect(body('venus').imagery?.color).toBeUndefined();
    expect(body('venus').imagery?.radar?.sourceId).toBe('usgs-venus-magellan-c3');
    expect(out.sources.sources.map((s) => s.id)).toEqual(expect.arrayContaining(['stsci-opal', 'nssdca-saturn-rings', 'nasa-svs-deep-star-maps']));
    expect(validateOutput(out, ephemeris)).toEqual([]);
  });

  it('adds the Moon as a satellite of Earth', () => {
    const m = body('moon');
    expect(m).toMatchObject({ name: 'Moon', category: 'moon', parentId: 'earth', naifId: 301 });
    expect(m.orbit.type).toBe('satellite');
    expect(m.shape).toMatchObject({ equatorialRadiusKm: 1737.4, polarRadiusKm: 1737.4, sourceId: 'naif-pck00011' });
    expect(m.description).toEqual({ text: 'Test description for moon.', sourceId: 'nasa-science-moon' });
    expect(m.facts.massKg?.value).toBeCloseTo(7.346e22, -18);
    expect(m.facts.meanDistanceFromParentKm).toMatchObject({ value: 384400, sourceId: 'nssdca-moon-fact-sheet' });
    expect(m.facts.periapsisKm?.value).toBeCloseTo(363300, 0);
    expect(m.facts.apoapsisKm?.value).toBeCloseTo(405500, 0);
    expect(m.facts.synodicPeriodDays?.value).toBe(29.53);
    expect(m.facts.orbitalPeriodDays).toMatchObject({ value: 27.3217, note: 'About Earth.' });
    expect(m.facts.equatorialDiameterKm).toMatchObject({ value: 3475, sourceId: 'nssdca-planetary-fact-sheet' });
    expect(m.facts.moonCount?.value).toBe(0);
    expect(m.facts.hasGlobalMagneticField?.value).toBe(false);
    expect(validateOutput(out, ephemeris)).toEqual([]);
  });

  it('the Moon has no heliocentric orbit facts', () => {
    const keys = Object.keys(body('moon').facts);
    for (const k of ['meanDistanceFromSunKm', 'perihelionKm', 'aphelionKm', 'semiMajorAxisAu']) expect(keys).not.toContain(k);
  });

  it('μ is 0.01215 to 4 significant figures, cited to the NAIF GM kernel', () => {
    const orbit = body('moon').orbit;
    if (orbit.type !== 'satellite') throw new Error('expected satellite');
    expect(Number(orbit.barycentre!.massRatio.value)).toBeCloseTo(0.01215, 5);
    expect(orbit.barycentre!.massRatio.sourceId).toBe('naif-gm-de440');
    expect(out.sources.sources.find((s) => s.id === 'naif-gm-de440')?.publisher).toMatch(/NAIF/);
    expect(out.sources.sources.map((s) => s.id)).toEqual(expect.arrayContaining(['jpl-sats-elem', 'nssdca-moon-fact-sheet', 'nasa-science-moon']));
  });

  it("the Moon's table check is ≤ 1 km and spans the committed table's range", () => {
    const orbit = body('moon').orbit;
    if (orbit.type !== 'satellite') throw new Error('expected satellite');
    const range = chebyshevRange(moonTable);
    expect([orbit.table.validFromJdTdb, orbit.table.validToJdTdb]).toEqual([range.fromJdTdb, range.toJdTdb]);
    expect(orbit.table.horizonsCheck).toEqual({ ...moonCheck.heldOutSummary, sourceId: 'jpl-horizons' });
    expect(orbit.table.horizonsCheck.maxDistanceErrorKm).toBeLessThanOrEqual(1);
    expect(orbit.meanElements).toMatchObject({ aKm: 384400, e: 0.0554, sourceId: 'jpl-sats-elem', validFromJdTdb: 625673.5, validToJdTdb: 2817152.5 });
    expect(orbit.meanElements.note).toContain('not intended for ephemeris computation');
  });

  it('measures the mean elements against Horizons outside 1800-2050 only', () => {
    const orbit = body('moon').orbit;
    if (orbit.type !== 'satellite') throw new Error('expected satellite');
    const check = orbit.meanElements.horizonsCheck!;
    expect(check.sampleCount).toBe(3);
    expect(check.maxAngularErrorArcsec).toBeGreaterThan(0);
    expect(check.sourceId).toBe('jpl-horizons');
  });

  it("Earth carries a centre check against Horizons' Earth centre, inside the Table 1 distance error", () => {
    const orbit = body('earth').orbit;
    if (orbit.type !== 'planet-approx') throw new Error('expected planet-approx');
    const check = orbit.centreCheck!;
    expect(check.sampleCount).toBe(6);
    expect(check.sourceId).toBe('jpl-horizons');
    expect(check.maxDistanceErrorKm).toBeLessThan(orbit.tables[0]!.nominalError.distanceKm);
  });

  it('fails the build when the committed table does not match its held-out summary', () => {
    const bad = structuredClone(moonTable);
    bad.segments[0]![0]! += 50;
    const check: HorizonsMoonCheck = { ...moonCheck, heldOut: moonCheck.heldOut.slice(0, 5) };
    const input = { approxPos: fixture('approx_pos.html'), planetSheet: fixture('planet-factsheet.html'), sunSheet: fixture('sun-factsheet.html'), pck: fixture('pck00011.tpc'), gmKernel: fixture('gm_de440.tpc'), moonSheet: fixture('moonfact.html'), satElemPage: fixture('jpl-sat-elem-moon.html'), descriptions, horizons, imagery };
    expect(() => buildSolarSystem({ ...input, moonTable: bad, moonCheck: check }, '2026-10-04T12:00:00.000Z')).toThrow(/held-out/);
  });

  it('fails validation when the ephemeris file is missing, covers another range or cites an unknown source', () => {
    expect(validateOutput(out, new Map()).some((e) => e.includes('ephemeris file solar-system/ephemeris/moon.json not found'))).toBe(true);
    const shorter = structuredClone(moonTable);
    shorter.segments.pop();
    const file = 'solar-system/ephemeris/moon.json';
    expect(validateOutput(out, new Map([[file, shorter]])).some((e) => e.includes('covers JD'))).toBe(true);
    expect(validateOutput(out, new Map([[file, { ...moonTable, sourceId: 'nowhere' }]])).some((e) => e.includes('unknown sourceId "nowhere"'))).toBe(true);
    expect(validateOutput(out, new Map([[file, { ...moonTable, frame: 'bad' }]])).length).toBeGreaterThan(0);
  });

  it('fails validation when a referenced source is missing', () => {
    const broken = structuredClone(out);
    broken.sources.sources = broken.sources.sources.filter((s) => s.id !== 'naif-pck00011');
    expect(validateOutput(broken, ephemeris).some((e) => e.includes('unknown sourceId "naif-pck00011"'))).toBe(true);
  });
});
