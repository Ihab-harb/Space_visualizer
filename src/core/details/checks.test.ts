import { describe, expect, it } from 'vitest';
import { makeJupiterDetails, makeMarsDetails, makeSunDetails } from '../../test/detailsFixtures';
import { TEST_SOURCES } from '../../test/fixtures';
import { checkDetails } from './checks';

const ctx = { radiusKm: 3389.5, knownSources: new Set(TEST_SOURCES.map((s) => s.id)) };

describe('checkDetails (spec §5)', () => {
  it('passes valid fixtures', () => {
    expect(checkDetails(makeMarsDetails(), ctx)).toEqual([]);
    expect(checkDetails(makeJupiterDetails(), { ...ctx, radiusKm: 71492 })).toEqual([]);
    expect(checkDetails(makeSunDetails(), { ...ctx, radiusKm: 695700 })).toEqual([]);
  });
  it('rejects layers out of order, above the radius, or with a non-zero innermost inner radius', () => {
    const d = makeMarsDetails();
    const [a, b] = d.interior!.layers;
    expect(checkDetails({ ...d, interior: { layers: [b!, a!] } }, ctx).join()).toContain('interior layers out of order at mantle -> crust');
    expect(checkDetails({ ...d, interior: { layers: [{ ...a!, outerRadiusKm: { ...a!.outerRadiusKm, max: 4000 } }, b!] } }, ctx).join()).toContain('interior crust outer radius 3389.5-4000 km outside 0-3389.5 km');
    const last = d.interior!.layers.at(-1)!;
    expect(checkDetails({ ...d, interior: { layers: [...d.interior!.layers.slice(0, -1), { ...last, innerRadiusKm: { ...last.innerRadiusKm, min: 5, max: 5 } }] } }, ctx).join()).toContain('innermost layer core must have inner radius 0');
  });
  it('rejects gases over 100 %, ppm at or above a million, and bad feature coordinates', () => {
    const d = makeMarsDetails();
    const gas = d.atmosphere!.major[0]!;
    expect(checkDetails({ ...d, atmosphere: { ...d.atmosphere!, major: [gas, { ...gas, name: 'X', amount: 10 }] } }, ctx).join()).toContain('over 100 %');
    expect(checkDetails({ ...d, atmosphere: { ...d.atmosphere!, minor: [{ ...d.atmosphere!.minor[0]!, amount: 1e6 }] } }, ctx).join()).toContain('is not below 10^6 ppm');
    const f = d.features!;
    expect(checkDetails({ ...d, features: { ...f, items: [{ ...f.items[0]!, latDeg: 95 }] } }, ctx).join()).toContain('feature Olympus Mons latitude 95');
    expect(checkDetails({ ...d, features: { ...f, items: [{ ...f.items[0]!, lonDegE: 360 }] } }, ctx).join()).toContain('feature Olympus Mons longitude 360');
  });
  it('rejects arrival before launch, a tilt over 180, and an unknown sourceId', () => {
    const d = makeMarsDetails();
    expect(checkDetails({ ...d, missions: [{ ...d.missions[0]!, launchDate: '1970-01-01', arrivalDate: '1969-01-01' }] }, ctx).join()).toContain('mission mariner-4 arrival 1969-01-01 before launch 1970-01-01');
    const j = makeJupiterDetails();
    if (j.magnetosphere.kind !== 'dipole') throw new Error('fixture');
    expect(checkDetails({ ...j, magnetosphere: { ...j.magnetosphere, tiltDeg: { value: 190, sourceId: j.magnetosphere.strengthGaussR3.sourceId } } }, { ...ctx, radiusKm: 71492 }).join()).toContain('dipole tilt 190 outside [0, 180]');
    expect(checkDetails({ ...d, discovery: { kind: 'antiquity', sourceId: 'nope' } }, ctx).join()).toMatch(/unknown sourceId "nope"/);
  });
});

describe('checkDetails: remaining spec §5 rules', () => {
  const layersOf = () => makeMarsDetails().interior!.layers;
  const withLayers = (layers: ReturnType<typeof layersOf>) => ({ ...makeMarsDetails(), interior: { layers } });
  const rng = (v: number) => ({ min: v, max: v, sourceId: 'nssdca-planetary-fact-sheet' });

  it('rejects a gap between consecutive layers', () => {
    const [crust, mantle, core] = layersOf();
    const out = checkDetails(withLayers([crust!, { ...mantle!, outerRadiusKm: rng(3000) }, core!]), ctx);
    expect(out).toContain('details/mars.json: interior gap or overlap between crust and mantle (inner 3339.5–3339.5 km vs outer 3000–3000 km)');
  });
  it('rejects an overlap between consecutive layers', () => {
    const [crust, mantle, core] = layersOf();
    const out = checkDetails(withLayers([crust!, { ...mantle!, outerRadiusKm: rng(3380) }, core!]), ctx);
    expect(out.join()).toContain('interior gap or overlap between crust and mantle (inner 3339.5–3339.5 km vs outer 3380–3380 km)');
  });
  it('allows a small boundary mismatch but not a large one', () => {
    const [crust, mantle, core] = layersOf();
    const at = (R: number, a: number, b: number) => checkDetails(withLayers([{ ...crust!, innerRadiusKm: rng(a) }, { ...mantle!, outerRadiusKm: rng(b) }, core!]), { ...ctx, radiusKm: R }).filter((e) => e.includes('gap or overlap'));
    expect(at(2439.7, 2039.7, 2074)).toEqual([]); // Mercury-style 34 km
    expect(at(695700, 495700, 493947)).toEqual([]); // Sun-style 1,753 km
    expect(at(6371, 3471, 1221)).not.toEqual([]); // 2,250 km
    expect(at(6371, 3471, 3421)).not.toEqual([]); // 50 km
  });
  it('rejects an inner radius above the outer radius', () => {
    const [crust, mantle, core] = layersOf();
    const out = checkDetails(withLayers([crust!, { ...mantle!, innerRadiusKm: rng(3339.6) }, core!]), ctx);
    expect(out.join()).toContain('interior mantle inner radius above outer radius');
  });
  it('rejects more than 200 features and more than the approved total', () => {
    const d = makeMarsDetails();
    const f = d.features!;
    const many = Array.from({ length: 201 }, () => f.items[0]!);
    const out = checkDetails({ ...d, features: { ...f, totalApproved: { ...f.totalApproved, value: 5000 }, items: many } }, ctx);
    expect(out.join()).toContain('201 features exceeds the 200 cap');
    expect(out.join()).not.toContain('approved total');
    const over = checkDetails({ ...d, features: { ...f, items: [f.items[0]!, f.items[0]!] } }, ctx);
    expect(over.join()).toContain('2 features exceeds the approved total 1');
  });
  it('rejects a feature diameter of zero or less', () => {
    const d = makeMarsDetails();
    const f = d.features!;
    expect(checkDetails({ ...d, features: { ...f, items: [{ ...f.items[0]!, diameterKm: 0 }] } }, ctx).join()).toContain('feature Olympus Mons diameter must be > 0');
  });
  it('rejects an invalid date string', () => {
    const d = makeMarsDetails();
    expect(checkDetails({ ...d, missions: [{ ...d.missions[0]!, launchDate: '2021-13-01', arrivalDate: null, endDate: null }] }, ctx).join()).toContain('mission mariner-4 has invalid date 2021-13-01');
  });
  it('rejects an end date before arrival', () => {
    const d = makeMarsDetails();
    expect(checkDetails({ ...d, missions: [{ ...d.missions[0]!, arrivalDate: '1965-07-14', endDate: '1965-01-01' }] }, ctx).join()).toContain('mission mariner-4 end 1965-01-01 before arrival/launch');
  });
  it('rejects a dipole offset outside [0, 1] and a strength of zero or less', () => {
    const j = makeJupiterDetails();
    if (j.magnetosphere.kind !== 'dipole') throw new Error('fixture');
    const jctx = { ...ctx, radiusKm: 71492 };
    expect(checkDetails({ ...j, magnetosphere: { ...j.magnetosphere, offsetRadii: { value: 1.5, sourceId: 'nasa-science-jupiter' } } }, jctx).join()).toContain('dipole offset 1.5 outside [0, 1]');
    expect(checkDetails({ ...j, magnetosphere: { ...j.magnetosphere, strengthGaussR3: { value: 0, sourceId: 'nasa-science-jupiter' } } }, jctx).join()).toContain('dipole strength must be > 0');
  });
  it('allows major gases up to 100.5 % and rejects 100.6 %', () => {
    const d = makeMarsDetails();
    const gas = d.atmosphere!.major[0]!;
    const sum = (rest: number) => ({ ...d, atmosphere: { ...d.atmosphere!, major: [{ ...gas, amount: 100 }, { ...gas, name: 'X', amount: rest }] } });
    expect(checkDetails(sum(0.5), ctx).join()).not.toContain('over 100 %');
    expect(checkDetails(sum(0.6), ctx).join()).toContain('major gases sum to 100.60 %, over 100 %');
  });
});

