import { describe, expect, it } from 'vitest';
import type { Body, SatelliteOrbit } from '../catalog/schema';
import type { Vec3 } from '../math/vec3';
import { calendarToJd } from '../time/julian';
import { makeEarth, makeMoon, makeMoonTable, makeSun, MOON_TABLE_RANGE } from '../../test/fixtures';
import { evaluateChebyshev } from './chebyshev';
import { planetApproxState } from './planetApprox';
import { satelliteGeocentricKm, systemState } from './system';

const bodies = [makeSun(), makeEarth(), makeMoon()];
const tables = new Map([['moon', makeMoonTable()]]);
const mid = MOON_TABLE_RANGE.from + 6.3;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const day = (year: number, month: number, d: number) => calendarToJd({ year, month, day: d, hour: 0, minute: 0, second: 0 });

describe('systemState', () => {
  it('barycentre split returns the barycentre', () => {
    const s = systemState(bodies, tables, mid);
    const earth = s.get('earth')!.positionKm;
    const moon = s.get('moon')!.positionKm;
    const mu = 0.01215;
    const mixed: Vec3 = [
      (1 - mu) * earth[0] + mu * moon[0],
      (1 - mu) * earth[1] + mu * moon[1],
      (1 - mu) * earth[2] + mu * moon[2],
    ];
    const earthOrbit = makeEarth().orbit;
    if (earthOrbit.type !== 'planet-approx') throw new Error('fixture Earth must be planet-approx');
    expect(dist(mixed, planetApproxState(earthOrbit, mid).positionKm)).toBeLessThan(1e-6);
  });

  it('moon minus earth equals the table vector', () => {
    const s = systemState(bodies, tables, mid);
    const e = s.get('earth')!.positionKm;
    const m = s.get('moon')!.positionKm;
    const rel: Vec3 = [m[0] - e[0], m[1] - e[1], m[2] - e[2]];
    expect(dist(rel, evaluateChebyshev(makeMoonTable(), mid)!)).toBeLessThan(1e-6);
    expect(s.get('moon')!.tableId).toBe('horizons-chebyshev');
  });

  it('uses mean elements outside the table', () => {
    const s = systemState(bodies, tables, MOON_TABLE_RANGE.to + 100);
    expect(s.get('moon')!.tableId).toBe('mean-elements');
    expect(s.get('moon')!.inValidRange).toBe(true);
    expect(s.get('moon')!.positionKm.every(Number.isFinite)).toBe(true);
  });

  it('uses mean elements when the table is not loaded', () => {
    const orbit = makeMoon().orbit as SatelliteOrbit;
    expect(satelliteGeocentricKm(orbit, new Map(), 'moon', mid).tableId).toBe('mean-elements');
  });

  it('stays finite at the clamp dates', () => {
    for (const jd of [0, day(9999, 12, 31)]) {
      const s = systemState(bodies, tables, jd);
      expect(s.get('moon')!.positionKm.every(Number.isFinite)).toBe(true);
      expect(s.get('earth')!.positionKm.every(Number.isFinite)).toBe(true);
      expect(s.get('moon')!.inValidRange).toBe(false);
    }
  });

  it('throws for a satellite without its parent', () => {
    const orphan: Body = { ...makeMoon(), parentId: 'mars' };
    expect(() => systemState([makeSun(), orphan], tables, mid)).toThrow('satellite "moon" has no parent "mars" in the catalogue');
  });

  it('a table boundary gives no jump', () => {
    // Compared relative to Earth: Earth itself moves about 2.6 km in the 1e-6 day step.
    const rel = (jd: number): Vec3 => {
      const s = systemState(bodies, tables, jd);
      const e = s.get('earth')!.positionKm;
      const m = s.get('moon')!.positionKm;
      return [m[0] - e[0], m[1] - e[1], m[2] - e[2]];
    };
    const to = MOON_TABLE_RANGE.to;
    expect(dist(rel(to - 1e-6), rel(to))).toBeLessThan(1);
  });
});
