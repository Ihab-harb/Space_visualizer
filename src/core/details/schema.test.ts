import { describe, expect, it } from 'vitest';
import { makeJupiterDetails, makeMarsDetails, makeSunDetails } from '../../test/detailsFixtures';
import { BodyDetailsSchema } from './schema';

describe('BodyDetailsSchema', () => {
  it('accepts a rocky planet, a giant and the Sun', () => {
    for (const d of [makeMarsDetails(), makeJupiterDetails(), makeSunDetails()]) expect(BodyDetailsSchema.safeParse(d).success).toBe(true);
  });
  it('rejects an unknown mission type, a percent gas listed as minor, and a missing sourceId', () => {
    const m = makeMarsDetails();
    expect(BodyDetailsSchema.safeParse({ ...m, missions: [{ ...m.missions[0]!, type: 'balloon' }] }).success).toBe(false);
    expect(BodyDetailsSchema.safeParse({ ...m, atmosphere: { ...m.atmosphere!, minor: [{ ...m.atmosphere!.major[0]! }] } }).success).toBe(false);
    const { sourceId: _drop, ...noSource } = m.missions[0]!;
    expect(BodyDetailsSchema.safeParse({ ...m, missions: [noSource] }).success).toBe(false);
  });
  it('rejects a range with min above max and an empty interior layers array', () => {
    const m = makeMarsDetails();
    const layer = m.interior!.layers[0]!;
    const bad = { ...layer, outerRadiusKm: { ...layer.outerRadiusKm, min: 10, max: 5 } };
    expect(BodyDetailsSchema.safeParse({ ...m, interior: { layers: [bad] } }).success).toBe(false);
    expect(BodyDetailsSchema.safeParse({ ...m, interior: { layers: [] } }).success).toBe(false);
  });
  it('accepts an exosphere with number densities and rejects a percent unit there', () => {
    const m = makeMarsDetails();
    const gas = { name: 'Helium 4', formula: '⁴He', amount: 40000, unit: 'cm⁻³', upperLimit: true, sourceId: 's' };
    const exo = { basis: 'night', kind: 'exosphere', major: [], minor: [], numberDensity: [gas], note: null };
    expect(BodyDetailsSchema.safeParse({ ...m, atmosphere: exo }).success).toBe(true);
    expect(BodyDetailsSchema.safeParse({ ...m, atmosphere: { ...exo, numberDensity: [{ ...gas, unit: '%' }] } }).success).toBe(false);
    expect(BodyDetailsSchema.safeParse({ ...m, atmosphere: { ...exo, numberDensity: [{ ...gas, amount: -1 }] } }).success).toBe(false);
    expect(BodyDetailsSchema.safeParse({ ...m, atmosphere: { ...exo, kind: 'plasma' } }).success).toBe(false);
  });
});
