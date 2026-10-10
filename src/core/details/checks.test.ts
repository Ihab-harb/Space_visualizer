import { describe, expect, it } from 'vitest';
import { makeJupiterDetails, makeMarsDetails } from '../../test/detailsFixtures';
import { TEST_SOURCES } from '../../test/fixtures';
import { checkDetails } from './checks';

const ctx = { radiusKm: 3389.5, knownSources: new Set(TEST_SOURCES.map((s) => s.id)) };

describe('checkDetails (spec §5)', () => {
  it('passes valid fixtures', () => {
    expect(checkDetails(makeMarsDetails(), ctx)).toEqual([]);
    expect(checkDetails(makeJupiterDetails(), { ...ctx, radiusKm: 71492 })).toEqual([]);
  });
  it('rejects layers out of order, above the radius, or with a non-zero innermost inner radius', () => {
    const d = makeMarsDetails();
    const [a, b] = d.interior!.layers;
    expect(checkDetails({ ...d, interior: { layers: [b!, a!] } }, ctx).join()).toMatch(/order/);
    expect(checkDetails({ ...d, interior: { layers: [{ ...a!, outerRadiusKm: { ...a!.outerRadiusKm, max: 4000 } }, b!] } }, ctx).join()).toMatch(/radius/);
    const last = d.interior!.layers.at(-1)!;
    expect(checkDetails({ ...d, interior: { layers: [...d.interior!.layers.slice(0, -1), { ...last, innerRadiusKm: { ...last.innerRadiusKm, min: 5, max: 5 } }] } }, ctx).join()).toMatch(/innermost/);
  });
  it('rejects gases over 100 %, ppm at or above a million, and bad feature coordinates', () => {
    const d = makeMarsDetails();
    const gas = d.atmosphere!.major[0]!;
    expect(checkDetails({ ...d, atmosphere: { ...d.atmosphere!, major: [gas, { ...gas, name: 'X', amount: 10 }] } }, ctx).join()).toMatch(/100/);
    expect(checkDetails({ ...d, atmosphere: { ...d.atmosphere!, minor: [{ ...d.atmosphere!.minor[0]!, amount: 1e6 }] } }, ctx).join()).toMatch(/ppm/);
    const f = d.features!;
    expect(checkDetails({ ...d, features: { ...f, items: [{ ...f.items[0]!, latDeg: 95 }] } }, ctx).join()).toMatch(/latitude/);
    expect(checkDetails({ ...d, features: { ...f, items: [{ ...f.items[0]!, lonDegE: 360 }] } }, ctx).join()).toMatch(/longitude/);
  });
  it('rejects arrival before launch, a tilt over 180, and an unknown sourceId', () => {
    const d = makeMarsDetails();
    expect(checkDetails({ ...d, missions: [{ ...d.missions[0]!, launchDate: '1970-01-01', arrivalDate: '1969-01-01' }] }, ctx).join()).toMatch(/arrival/);
    const j = makeJupiterDetails();
    if (j.magnetosphere.kind !== 'dipole') throw new Error('fixture');
    expect(checkDetails({ ...j, magnetosphere: { ...j.magnetosphere, tiltDeg: { value: 190, sourceId: j.magnetosphere.strengthGaussR3.sourceId } } }, { ...ctx, radiusKm: 71492 }).join()).toMatch(/tilt/);
    expect(checkDetails({ ...d, discovery: { kind: 'antiquity', sourceId: 'nope' } }, ctx).join()).toMatch(/unknown sourceId "nope"/);
  });
});
