import { describe, expect, it } from 'vitest';
import reference from '../../../pipeline/reference/horizons-heliocentric.json';
import { APPROX_ORBITS, TABLE1_RANGE, type ApproxBodyKey } from '../../test/approxOrbits';
import { ARCSEC } from '../math/angles';
import { angleBetween, length, type Vec3 } from '../math/vec3';
import { elementsAt, planetApproxState, selectTable } from './planetApprox';

const TOLERANCE_FACTOR = 3;
/** Measured while writing the plan: JPL's published Table 1 nominal for Neptune is exceeded up to 4.5x / 7.1x. */
const TOLERANCE_OVERRIDES: Record<string, number> = { 'neptune:1800-2050': 10 };

describe('planetApproxState vs JPL Horizons (DE441, system barycentres)', () => {
  const cases = reference.samples.map((s) => [s.body, s.jdTdb, s] as const);
  it.each(cases)('%s at JD %d', (_body, _jd, sample) => {
    const orbit = APPROX_ORBITS[sample.body as ApproxBodyKey];
    const state = planetApproxState(orbit, sample.jdTdb);
    const table = orbit.tables.find((t) => t.id === state.tableId)!;
    const factor = TOLERANCE_OVERRIDES[`${sample.body}:${table.id}`] ?? TOLERANCE_FACTOR;
    const ref = sample.positionKm as unknown as Vec3;
    const angularArcsec = angleBetween(state.positionKm, ref) / ARCSEC;
    const radialKm = Math.abs(length(state.positionKm) - length(ref));
    expect(state.inValidRange).toBe(true);
    expect(angularArcsec).toBeLessThanOrEqual(factor * Math.hypot(table.nominalError.longitudeArcsec, table.nominalError.latitudeArcsec));
    expect(radialKm).toBeLessThanOrEqual(factor * table.nominalError.distanceKm);
  });
});

describe('table selection', () => {
  it('prefers Table 1 inside 1800-2050, inclusive at both ends', () => {
    expect(selectTable(APPROX_ORBITS.mars.tables, TABLE1_RANGE.from)).toMatchObject({ index: 0, inValidRange: true });
    expect(selectTable(APPROX_ORBITS.mars.tables, TABLE1_RANGE.to)).toMatchObject({ index: 0, inValidRange: true });
    expect(selectTable(APPROX_ORBITS.mars.tables, TABLE1_RANGE.from - 1)).toMatchObject({ index: 1, inValidRange: true });
  });
  it('falls back to the widest table, flagged out of range, beyond every table', () => {
    for (const jd of [0, 5373484.5]) {
      for (const orbit of Object.values(APPROX_ORBITS)) {
        const state = planetApproxState(orbit, jd);
        expect(state.inValidRange).toBe(false);
        expect(state.tableId).toBe('3000BC-3000AD');
        expect(state.positionKm.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe('elementsAt', () => {
  it('reproduces J2000 Table 1 elements for Jupiter', () => {
    const el = elementsAt(APPROX_ORBITS.jupiter.tables[0]!, 2451545.0);
    expect(el.aKm).toBeCloseTo(5.202887 * 149_597_870.7, 0);
    expect(el.e).toBeCloseTo(0.04838624, 12);
    // M = L - varpi = 34.39644051 - 14.72847983 deg
    expect(el.meanAnomalyRad).toBeCloseTo((19.66796068 * Math.PI) / 180, 12);
  });
});
