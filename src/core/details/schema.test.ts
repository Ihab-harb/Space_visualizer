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
});
