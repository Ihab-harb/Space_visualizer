import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Body } from '../../src/core/catalog/schema';
import { makeCatalogFiles, makeEarth } from '../../src/test/fixtures';
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
    planetSheets, sunSheet,
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
    expect(m.interior!.layers[0]!.outerRadiusKm).toEqual({ min: 3389.5, max: 3389.5, sourceId: 'test-page' });
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
  });
});
