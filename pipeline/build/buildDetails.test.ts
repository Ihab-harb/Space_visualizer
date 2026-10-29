import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Body } from '../../src/core/catalog/schema';
import { makeCatalogFiles, makeEarth, makeMoon } from '../../src/test/fixtures';
import type { FetchedText } from '../lib/fetchCached';
import { PLANET_SHEET_IDS } from '../sources/nssdcPlanetSheet';
import type { InteriorsFile, MissionsFile } from '../sources/quotedReference';
import { buildDetails, type DetailsInputs } from './buildDetails';

const fetched = (text: string): FetchedText => ({ text, retrievedAt: '2026-10-10', fromCache: true });
const planetSheets = Object.fromEntries(
  PLANET_SHEET_IDS.map((id) => [id, fetched(readFileSync(`pipeline/fixtures/planets/${id}fact.html`, 'utf8'))]),
) as DetailsInputs['planetSheets'];
const sunSheet = fetched(readFileSync('pipeline/fixtures/sun-factsheet.html', 'utf8'));

const PS = 'nssdca-planetary-fact-sheet';
const mars: Body = {
  ...makeEarth(), id: 'mars', name: 'Mars', naifId: 499,
  facts: { hasGlobalMagneticField: { value: false, sourceId: PS } },
  shape: { equatorialRadiusKm: 3396.19, polarRadiusKm: 3376.2, sourceId: 'naif-pck00011' },
};
const bodies = [...makeCatalogFiles().bodies.bodies.filter((b) => b.id !== 'earth'), mars];

const PAGE = '<p>The crust and mantle of Mars extend about 1,566 kilometres deep according to this page text. The core of Mars has a radius of about 1,830 kilometres.</p><p>The Mariner 4 spacecraft launched on November 28, 1964 and flew past Mars on July 14, 1965.</p>';
const Q_CRUST = 'The crust and mantle of Mars extend about 1,566 kilometres deep according to this page text';
const Q_CORE = 'The core of Mars has a radius of about 1,830 kilometres';
const Q_MARINER = 'The Mariner 4 spacecraft launched on November 28, 1964 and flew past Mars on July 14, 1965';
const src = { id: 'test-page', title: 'Test page', publisher: 'NASA', url: 'https://science.nasa.gov/test', license: 'NASA public domain' };

const interiors = (quote = Q_CORE): InteriorsFile => ({
  sources: [src],
  bodies: {
    mars: {
      layers: [
        { id: 'crust-mantle', name: 'Crust and mantle', from: 'depth', outer: { min: 0, max: 0, sourceId: 'test-page', quote: Q_CRUST }, inner: { min: 1566, max: 1566, sourceId: 'test-page', quote: Q_CRUST }, state: 'solid', composition: null, uncertain: false },
        { id: 'core', name: 'Core', from: 'radius', outer: { min: 1830, max: 1830, sourceId: 'test-page', quote }, inner: { min: 0, max: 0, sourceId: 'test-page', quote }, state: 'liquid', composition: null, uncertain: true },
      ],
    },
  },
});
const missions: MissionsFile = {
  sources: [src],
  bodies: {
    mars: {
      discovery: { kind: 'antiquity', sourceId: 'test-page', quote: Q_CRUST },
      missions: [{ id: 'mariner-4', name: 'Mariner 4', agency: 'NASA', type: 'flyby', launchDate: '1964-11-28', arrivalDate: '1965-07-14', endDate: null, outcome: 'success', sourceId: 'test-page', quotes: [Q_MARINER] }],
    },
  },
};

const rows = [
  { name: 'Olympus Mons', clean_name: 'Olympus Mons', approvaldt: '1973/01/01 00:00:00', origin: 'Classical albedo feature', diameter: '648.9', center_lon: '226.2', center_lat: '18.65', type: 'Mons, montes', approval: 'Adopted by IAU' },
];

function inputs(over: Partial<DetailsInputs> = {}): DetailsInputs {
  return {
    bodies,
    existingSourceIds: new Set(makeCatalogFiles().sources.sources.map((s) => s.id)),
    planetSheets, sunSheet, moonSheet: fetched(readFileSync('pipeline/fixtures/moonfact.html', 'utf8')),
    gazetteer: { mars: { rows, retrievedAt: '2026-10-09' } },
    interiors: interiors(), missions,
    curatedPages: new Map([['test-page', fetched(PAGE)]]),
    ...over,
  };
}
const build = (over?: Partial<DetailsInputs>) => buildDetails(inputs(over), '2026-10-10T00:00:00.000Z');

describe('buildDetails', () => {
  it('builds Mars: no field, parsed atmosphere, features and depth-converted interior', () => {
    const { details, errors } = build();
    const m = details.find((d) => d.bodyId === 'mars')!;
    expect(m.magnetosphere).toEqual({ kind: 'none', sourceId: PS });
    expect(m.atmosphere!.major.find((g) => g.formula === 'CO2')!.amount).toBe(95.1);
    expect(m.features!.items[0]!.name).toBe('Olympus Mons');
    expect(m.features!.sourceId).toBe('usgs-gazetteer-mars');
    expect(m.interior!.layers[0]!.outerRadiusKm).toEqual({ min: 3389.5, max: 3389.5, sourceId: 'test-page', from: 'depth', stated: { min: 0, max: 0 } });
    expect(m.interior!.layers[0]!.innerRadiusKm.min).toBeCloseTo(1823.5, 6);
    expect(m.missions[0]).not.toHaveProperty('quotes');
    expect(m.discovery).toEqual({ kind: 'antiquity', sourceId: 'test-page' });
    expect(errors).toEqual([]);
  });

  it('gives Jupiter a dipole field, no features and no interior', () => {
    const j = build().details.find((d) => d.bodyId === 'jupiter')!;
    expect(j.magnetosphere.kind).toBe('dipole');
    expect(j.features).toBeNull();
    expect(j.interior).toBeNull();
  });

  it('gives the Sun the other-field note and photosphere gases', () => {
    const s = build().details.find((d) => d.bodyId === 'sun')!;
    expect(s.magnetosphere.kind).toBe('other');
    expect(s.atmosphere!.basis).toMatch(/photosphere/i);
    expect(s.atmosphere!.major.length).toBeGreaterThan(0);
  });

  it('adds only referenced new sources, with retrievedAt', () => {
    const { sources, details } = build();
    const ids = sources.map((s) => s.id);
    expect(ids).toContain('nssdca-mars-fact-sheet');
    expect(ids).toContain('usgs-gazetteer-mars');
    expect(sources.find((s) => s.id === 'usgs-gazetteer-mars')!.retrievedAt).toBe('2026-10-09');
    expect(sources.find((s) => s.id === 'nssdca-mars-fact-sheet')!.retrievedAt).toBe('2026-10-10');
    expect(ids).not.toContain('usgs-gazetteer-venus');
    expect(ids).not.toContain('nssdca-sun-fact-sheet');
    const used = new Set(JSON.stringify(details).match(/"sourceId":"[^"]+"/g)!.map((s) => s.slice(12, -1)));
    for (const id of ids) expect(used.has(id)).toBe(true);
  });

  it('reports a curated quote that is not on its page', () => {
    const { errors } = build({ curatedPages: new Map([['test-page', fetched('<p>Nothing relevant here at all, sorry.</p>')]]) });
    expect(errors.some((e) => e.includes('test-page'))).toBe(true);
  });

  it('reports a collision with an existing source id', () => {
    const { errors } = build({ existingSourceIds: new Set(['test-page', ...makeCatalogFiles().sources.sources.map((s) => s.id)]) });
    expect(errors.some((e) => e.includes('collides'))).toBe(true);
  });

  it('uses the sheet mean radius (not equatorial) and converts mixed per-bound from exactly', () => {
    const earth: Body = { ...makeEarth(), shape: { equatorialRadiusKm: 6378.1366, polarRadiusKm: 6356.7519, sourceId: 'naif-pck00011' } };
    const q = (k: string) => 'The crust and mantle of Earth extend about ' + k + ' kilometres deep according to this page text';
    const page = '<p>' + q('30') + '.</p><p>' + q('3,485') + '.</p><p>The inner mantle boundary of Earth lies at 3,485 km from the centre according to this page text.</p>';
    const rq = (n: number) => ({ min: n, max: n, sourceId: 'test-page', quote: n === 30 ? q('30') : q('3,485') });
    const file: InteriorsFile = {
      sources: [src],
      bodies: { earth: { layers: [
        { id: 'crust', name: 'Crust', from: 'depth', outer: { min: 0, max: 0, sourceId: 'test-page', quote: q('30') }, inner: rq(30), state: 'solid', composition: null, uncertain: false },
        { id: 'mantle', name: 'Mantle', from: 'depth', outer: rq(30), inner: { ...rq(3485), from: 'radius' }, state: 'solid', composition: null, uncertain: false },
        { id: 'core', name: 'Core', from: 'radius', outer: rq(3485), inner: { min: 0, max: 0, sourceId: 'test-page', quote: q('3,485') }, state: 'liquid', composition: null, uncertain: false },
      ] } },
    };
    const { details, errors } = build({ bodies: [...bodies, earth], interiors: file, missions: { sources: [src], bodies: {} }, curatedPages: new Map([['test-page', fetched(page)]]) });
    expect(errors).toEqual([]);
    const l = details.find((d) => d.bodyId === 'earth')!.interior!.layers;
    expect(l[0]!.outerRadiusKm.max).toBe(6371);
    expect(l[0]!.innerRadiusKm.min).toBe(6341);
    expect(l[1]!.outerRadiusKm.min).toBe(6341);
    expect(l[1]!.innerRadiusKm.max).toBe(3485);
    // Each bound records the form its source used, with the numbers as the source states them.
    expect(l[0]!.outerRadiusKm).toMatchObject({ from: 'depth', stated: { min: 0, max: 0 } });
    expect(l[1]!.outerRadiusKm).toMatchObject({ from: 'depth', stated: { min: 30, max: 30 } });
    expect(l[1]!.innerRadiusKm).toMatchObject({ from: 'radius', min: 3485, max: 3485 });
    expect(l[1]!.innerRadiusKm).not.toHaveProperty('stated');
  });

  it('converts a percent layer to exact radii of the Sun', () => {
    const q = 'The radiative zone of the Sun extends to about 70 percent of the solar radius according to this page text';
    const page = '<p>' + q + '. The core of the Sun reaches 25 percent of the solar radius according to this page text.</p>';
    const pr = (n: number, quote = q) => ({ min: n, max: n, sourceId: 'test-page', quote });
    const q2 = 'The core of the Sun reaches 25 percent of the solar radius according to this page text';
    const file: InteriorsFile = {
      sources: [src],
      bodies: { sun: { layers: [
        { id: 'radiative', name: 'Radiative zone', from: 'percent', outer: pr(70), inner: pr(25, q2), state: 'plasma', composition: null, uncertain: false },
        { id: 'core', name: 'Core', from: 'percent', outer: pr(25, q2), inner: { min: 0, max: 0, sourceId: 'test-page', quote: q2 }, state: 'plasma', composition: null, uncertain: false },
      ] } },
    };
    const { details } = build({ interiors: file, missions: { sources: [src], bodies: {} }, curatedPages: new Map([['test-page', fetched(page)]]) });
    const l = details.find((d) => d.bodyId === 'sun')!.interior!.layers;
    expect(l[0]!.outerRadiusKm.max).toBeCloseTo(486990, 6);
    expect(l[0]!.innerRadiusKm.min).toBeCloseTo(173925, 6);
    expect(l[0]!.outerRadiusKm).toMatchObject({ from: 'percent', stated: { min: 70, max: 70 } });
    expect(l[0]!.innerRadiusKm).toMatchObject({ from: 'percent', stated: { min: 25, max: 25 } });
  });

  it('carries a cited layer state through as stateSourceId, and checks its quote', () => {
    const withState = (quote: string): InteriorsFile => {
      const f = interiors();
      f.bodies.mars!.layers[1]!.stateSource = { sourceId: 'test-page', quote };
      return f;
    };
    const ok = build({ interiors: withState(Q_CORE) });
    expect(ok.errors).toEqual([]);
    const layers = ok.details.find((d) => d.bodyId === 'mars')!.interior!.layers;
    expect(layers[1]!.stateSourceId).toBe('test-page');
    expect(layers[0]!).not.toHaveProperty('stateSourceId');
    expect(build({ interiors: withState('This sentence is certainly not on the page at all') }).errors.some((e) => e.includes('stateSource') || e.includes('quote not on page'))).toBe(true);
  });

  it('points a curated source at the registered source for the same page instead of listing the page twice', () => {
    const dup = { ...src, id: 'curated-mars-sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html' };
    const existing = { ...src, id: 'catalog-page', url: 'https://science.nasa.gov/catalog-page/' };
    const dupExisting = { ...src, id: 'curated-catalog-page', url: existing.url };
    const file = interiors();
    file.sources = [src, dup, dupExisting];
    file.bodies.mars!.layers[0]!.composition = { sourceId: 'curated-mars-sheet', quote: Q_CRUST, text: 'x' };
    file.bodies.mars!.layers[1]!.composition = { sourceId: 'curated-catalog-page', quote: Q_CORE, text: 'y' };
    const pages = new Map([['test-page', fetched(PAGE)], ['curated-mars-sheet', fetched(PAGE)], ['curated-catalog-page', fetched(PAGE)]]);
    const out = build({
      interiors: file, curatedPages: pages,
      existingSourceIds: new Set([...makeCatalogFiles().sources.sources.map((s) => s.id), 'catalog-page']),
      existingSourceUrls: new Map([[existing.url, 'catalog-page']]),
    });
    expect(out.errors).toEqual([]);
    const layers = out.details.find((d) => d.bodyId === 'mars')!.interior!.layers;
    expect(layers[0]!.composition!.sourceId).toBe('nssdca-mars-fact-sheet');
    expect(layers[1]!.composition!.sourceId).toBe('catalog-page');
    const ids = out.sources.map((s) => s.id);
    expect(ids).not.toContain('curated-mars-sheet');
    expect(ids).not.toContain('curated-catalog-page');
    expect(new Set(out.sources.map((s) => s.url)).size).toBe(out.sources.length);
  });

  it('lists missions in launch order, then by name', () => {
    const base = missions.bodies.mars!.missions[0]!;
    const mk = (id: string, name: string, launchDate: string) => ({ ...base, id, name, launchDate, arrivalDate: null });
    const file: MissionsFile = { sources: [src], bodies: { mars: { discovery: null, missions: [
      mk('c', 'Zeta', '1990-01-01'), mk('b', 'Beta', '1964-11-28'), mk('a', 'Alpha', '1964-11-28'),
    ] } } };
    const page = PAGE + '<p>' + 'Alpha' + '</p>';
    const out = build({ missions: file, curatedPages: new Map([['test-page', fetched(page)]]) });
    expect(out.details.find((d) => d.bodyId === 'mars')!.missions.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  describe('the Moon', () => {
    const MS = 'nssdca-moon-fact-sheet';
    const moon: Body = {
      ...makeMoon(),
      facts: { hasGlobalMagneticField: { value: false, sourceId: PS }, meanRadiusKm: { value: 1737.4, sourceId: MS } },
    };
    const MOON_PAGE = '<p>The Moon today has a very weak magnetic field according to this page text. The Moon core extends about 20 percent of the way from the Moon center to its surface.</p><p>The Apollo 8 crew launched Dec. 21, 1968 and splashed down Dec. 27, 1968 according to this page.</p>';
    const Q_FIELD = 'The Moon today has a very weak magnetic field according to this page text';
    const Q_MCORE = 'The Moon core extends about 20 percent of the way from the Moon center to its surface';
    const Q_A8 = 'The Apollo 8 crew launched Dec. 21, 1968 and splashed down Dec. 27, 1968 according to this page';
    const moonSrc = { ...src, id: 'moon-page', url: 'https://science.nasa.gov/moon/test/' };
    const moonRows = [
      { name: 'Mare Imbrium', clean_name: 'Mare Imbrium', approvaldt: '1935/01/01 00:00:00', origin: 'Latin for sea of showers', diameter: '1123', center_lon: '342.1', center_lat: '32.8', type: 'Mare, maria', approval: 'Adopted by IAU' },
      { name: 'Tycho', clean_name: 'Tycho', approvaldt: '1935/01/01 00:00:00', origin: 'Tycho Brahe', diameter: '85', center_lon: '348.7', center_lat: '-43.3', type: 'Crater, craters', approval: 'Adopted by IAU' },
    ];
    const FIELD = { sourceId: 'moon-page', quote: Q_FIELD, text: 'The Moon today has a very weak magnetic field' };
    const moonMissions = (quote = Q_A8): MissionsFile => ({
      sources: [moonSrc],
      bodies: { moon: { discovery: { kind: 'antiquity', sourceId: 'moon-page', quote: Q_FIELD }, missions: [{ id: 'apollo-8', name: 'Apollo 8', agency: 'NASA', type: 'orbiter', launchDate: '1968-12-21', arrivalDate: null, endDate: '1968-12-27', outcome: 'success', sourceId: 'moon-page', quotes: [quote] }] } },
    });
    const withMoon = (over: Partial<DetailsInputs> = {}) => {
      return build({
        bodies: [...bodies, moon],
        existingSourceIds: new Set([...makeCatalogFiles().sources.sources.map((s) => s.id), MS]),
        gazetteer: { mars: { rows, retrievedAt: '2026-10-09' }, moon: { rows: moonRows, retrievedAt: '2026-10-29' } },
        interiors: { sources: [moonSrc], bodies: {} }, missions: moonMissions(),
        curatedPages: new Map([['moon-page', fetched(MOON_PAGE)]]),
        ...over,
      });
    };

    it('builds an exosphere, an other-kind field, missions and named features from the Moon sheet and Gazetteer', () => {
      const { details, errors, sources } = withMoon({ interiors: { sources: [moonSrc], bodies: { moon: { layers: [], magneticField: FIELD } } } });
      const m = details.find((d) => d.bodyId === 'moon')!;
      expect(m.atmosphere!.kind).toBe('exosphere');
      expect(m.atmosphere!.numberDensity!.find((g) => g.name === 'Helium 4')!.amount).toBe(40000);
      expect(m.atmosphere!.numberDensity!.every((g) => g.sourceId === MS)).toBe(true);
      expect(m.magnetosphere).toEqual({ kind: 'other', note: { text: 'The Moon today has a very weak magnetic field', sourceId: 'moon-page' } });
      expect(m.features!.sourceId).toBe('usgs-gazetteer-moon');
      expect(m.features!.totalApproved.value).toBe(2);
      expect(m.features!.thresholdKm).toBe(85);
      expect(m.missions.map((x) => x.id)).toEqual(['apollo-8']);
      expect(m.discovery).toEqual({ kind: 'antiquity', sourceId: 'moon-page' });
      expect(sources.map((s) => s.id)).not.toContain(MS); // already registered in the catalogue
      expect(sources.map((s) => s.id)).toContain('usgs-gazetteer-moon');
      expect(errors).toEqual([]);
    });

    it('falls back to the Planetary Fact Sheet "no field" when no field sentence is curated', () => {
      const m = withMoon().details.find((d) => d.bodyId === 'moon')!;
      expect(m.magnetosphere).toEqual({ kind: 'none', sourceId: PS });
      expect(m.interior).toBeNull();
    });

    it('converts a percent-of-radius Moon core and checks the field sentence against its page', () => {
      const file: InteriorsFile = { sources: [moonSrc], bodies: { moon: { layers: [
        { id: 'core', name: 'Core', from: 'percent', outer: { min: 20, max: 20, sourceId: 'moon-page', quote: Q_MCORE }, inner: { min: 0, max: 0, sourceId: 'moon-page', quote: Q_MCORE }, state: 'unknown', composition: null, uncertain: false },
      ] } } };
      const ok = withMoon({ interiors: file });
      // A single core layer alone is a valid interior.
      expect(ok.details.find((d) => d.bodyId === 'moon')!.interior!.layers[0]!.outerRadiusKm.max).toBeCloseTo(347.48, 6);
      const bad: InteriorsFile = { sources: [moonSrc], bodies: { moon: { layers: file.bodies.moon!.layers, magneticField: { sourceId: 'moon-page', quote: 'This sentence about the magnetic field is not on the page', text: 'x' } } } };
      expect(withMoon({ interiors: bad }).errors.join()).toContain('magneticField');
    });
  });
});
