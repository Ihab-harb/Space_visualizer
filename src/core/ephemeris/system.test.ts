import { describe, expect, it } from 'vitest';
import type { Body, SatelliteOrbit } from '../catalog/schema';
import type { Vec3 } from '../math/vec3';
import { calendarToJd } from '../time/julian';
import { makeEarth, makeMoon, makeMoonTable, makeSun, MOON_TABLE_RANGE } from '../../test/fixtures';
import { evaluateChebyshev } from './chebyshev';
import { planetApproxState } from './planetApprox';
import { meanElementsGeocentricKm } from './meanElements';
import { satelliteGeocentricKm, satelliteOrbitPathKm, systemState } from './system';

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

  const rel = (jd: number): Vec3 => {
    const s = systemState(bodies, tables, jd);
    const e = s.get('earth')!.positionKm;
    const m = s.get('moon')!.positionKm;
    return [m[0] - e[0], m[1] - e[1], m[2] - e[2]];
  };

  it('a segment boundary inside the table gives no jump', () => {
    // Segments are 4 days long; compare Moon minus Earth across each interior boundary.
    for (const k of [1, 2, 3]) {
      const edge = MOON_TABLE_RANGE.from + 4 * k;
      expect(dist(rel(edge - 1e-6), rel(edge + 1e-6))).toBeLessThan(1);
    }
  });

  it('just past the table edge it falls back to mean elements (a jump there is expected)', () => {
    const s = systemState(bodies, tables, MOON_TABLE_RANGE.to + 1 / 86400);
    expect(s.get('moon')!.tableId).toBe('mean-elements');
    expect(s.get('moon')!.positionKm.every(Number.isFinite)).toBe(true);
  });
});

describe('satelliteOrbitPathKm', () => {
  const orbit = makeMoon().orbit as SatelliteOrbit;
  const norm = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
  // A table whose positions are doubled, so a point from the table cannot be mistaken for a mean-elements point.
  const doubled = (() => {
    const t = makeMoonTable();
    return new Map([['moon', { ...t, segments: t.segments.map((seg) => seg.map((c) => c * 2)) }]]);
  })();
  const period = orbit.meanElements.siderealPeriodDays;

  it('uses only the mean elements when the date is outside the table', () => {
    const jd = MOON_TABLE_RANGE.to + 100;
    const path = satelliteOrbitPathKm(orbit, doubled, 'moon', jd, 40);
    expect(path).toHaveLength(40);
    path.forEach((p, i) => {
      const t = jd - period / 2 + (period * i) / 39;
      expect(dist(p, meanElementsGeocentricKm(orbit.meanElements, t))).toBeLessThan(1e-6);
    });
  });

  it('uses only the table when the date is inside it, even if the window reaches past the edge', () => {
    const path = satelliteOrbitPathKm(orbit, doubled, 'moon', MOON_TABLE_RANGE.to - 1, 40);
    for (const p of path) expect(norm(p)).toBeGreaterThan(600000); // doubled table, never the ~384,000 km mean-elements radius
  });

  it('uses only the mean elements when the table is not loaded', () => {
    const path = satelliteOrbitPathKm(orbit, new Map(), 'moon', mid, 10);
    for (const p of path) expect(norm(p)).toBeLessThan(420000);
  });
});
