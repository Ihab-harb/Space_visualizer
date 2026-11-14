import type { Body, ChebyshevFile, SatelliteOrbit } from '../catalog/schema';
import { add, scale, sub, type Vec3 } from '../math/vec3';
import { evaluateChebyshev } from './chebyshev';
import { meanElementsGeocentricKm } from './meanElements';
import { bodyState } from './state';
import type { BodyState } from './types';

export interface SatelliteVector {
  /** Position relative to the parent's centre, ecliptic J2000, km. */
  r: Vec3;
  tableId: 'horizons-chebyshev' | 'mean-elements';
  inValidRange: boolean;
}

/** Chebyshev table when it is loaded and covers the date; otherwise the mean elements. */
export function satelliteGeocentricKm(
  orbit: SatelliteOrbit,
  tables: ReadonlyMap<string, ChebyshevFile>,
  bodyId: string,
  jdTdb: number,
): SatelliteVector {
  const file = tables.get(bodyId);
  const inTable = jdTdb >= orbit.table.validFromJdTdb && jdTdb <= orbit.table.validToJdTdb;
  if (file && inTable) {
    const r = evaluateChebyshev(file, jdTdb);
    if (r) return { r, tableId: 'horizons-chebyshev', inValidRange: true };
  }
  // Fallback: outside the table, or if evaluateChebyshev returns null inside its nominal range.
  // The jump to the mean elements at the table edge is expected (they are a coarser model).
  const m = orbit.meanElements;
  return {
    r: meanElementsGeocentricKm(m, jdTdb),
    tableId: 'mean-elements',
    inValidRange: jdTdb >= m.validFromJdTdb && jdTdb <= m.validToJdTdb,
  };
}

/**
 * The satellite's path over one sidereal period around a date, sampled with the single model in force at that date,
 * so the line never joins the table and the mean elements. Inside the table the window is slid to stay inside it
 * (clamped when the table is shorter than one period). Parent-relative, km.
 */
export function satelliteOrbitPathKm(
  orbit: SatelliteOrbit,
  tables: ReadonlyMap<string, ChebyshevFile>,
  bodyId: string,
  jdTdb: number,
  points: number,
): Vec3[] {
  const period = orbit.meanElements.siderealPeriodDays;
  const file = tables.get(bodyId);
  const from = orbit.table.validFromJdTdb;
  const to = orbit.table.validToJdTdb;
  const useTable = !!file && jdTdb >= from && jdTdb <= to && evaluateChebyshev(file, jdTdb) !== null;
  let start = jdTdb - period / 2;
  if (useTable) start = Math.max(from, Math.min(start, to - period));
  const out: Vec3[] = [];
  for (let i = 0; i < points; i++) {
    const jd = start + (period * i) / Math.max(points - 1, 1);
    const r = useTable ? evaluateChebyshev(file!, Math.min(Math.max(jd, from), to)) : null;
    out.push(r ?? meanElementsGeocentricKm(orbit.meanElements, jd));
  }
  return out;
}

/** Every body's position for one date. Satellites follow their parent; Earth is moved off the Earth-Moon barycentre. */
export function systemState(
  bodies: readonly Body[],
  tables: ReadonlyMap<string, ChebyshevFile>,
  jdTdb: number,
): Map<string, BodyState> {
  const byId = new Map(bodies.map((b) => [b.id, b]));
  const out = new Map<string, BodyState>();
  for (const body of bodies) {
    if (body.orbit.type !== 'satellite') out.set(body.id, bodyState(body, jdTdb));
  }
  for (const body of bodies) {
    const orbit = body.orbit;
    if (orbit.type !== 'satellite') continue;
    const parent = body.parentId === null ? undefined : byId.get(body.parentId);
    const parentState = body.parentId === null ? undefined : out.get(body.parentId);
    if (!parent || !parentState) {
      throw new Error(`satellite "${body.id}" has no parent "${body.parentId}" in the catalogue`);
    }
    const sat = satelliteGeocentricKm(orbit, tables, body.id, jdTdb);
    let parentPos = parentState.positionKm;
    if (
      orbit.barycentre &&
      parent.orbit.type === 'planet-approx' &&
      parent.orbit.represents === 'earth-moon-barycenter'
    ) {
      const mu = Number(orbit.barycentre.massRatio.value);
      parentPos = sub(parentPos, scale(sat.r, mu));
      out.set(parent.id, { ...parentState, positionKm: parentPos });
    }
    out.set(body.id, { positionKm: add(parentPos, sat.r), inValidRange: sat.inValidRange, tableId: sat.tableId });
  }
  return out;
}
