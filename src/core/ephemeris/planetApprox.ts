import type { ApproxTable, PlanetApproxOrbit } from '../catalog/schema';
import { DEG, normalizeDeg180 } from '../math/angles';
import { AU_KM, DAYS_PER_JULIAN_CENTURY, J2000_JD } from '../units';
import { positionAtEccentricAnomaly, type ConicElements } from './conic';
import { solveKeplerElliptic } from './kepler';
import type { BodyState } from './types';

export type ApproxElements = ConicElements & { meanAnomalyRad: number };

export function centuriesSinceJ2000(jdTdb: number): number {
  return (jdTdb - J2000_JD) / DAYS_PER_JULIAN_CENTURY;
}

/** First table whose range contains the date; otherwise the widest table, flagged out of range. */
export function selectTable(
  tables: readonly ApproxTable[],
  jdTdb: number,
): { table: ApproxTable; index: number; inValidRange: boolean } {
  const inside = tables.findIndex((t) => jdTdb >= t.validFromJdTdb && jdTdb <= t.validToJdTdb);
  if (inside >= 0) return { table: tables[inside]!, index: inside, inValidRange: true };
  let widest = 0;
  tables.forEach((t, i) => {
    const w = tables[widest]!;
    if (t.validToJdTdb - t.validFromJdTdb > w.validToJdTdb - w.validFromJdTdb) widest = i;
  });
  return { table: tables[widest]!, index: widest, inValidRange: false };
}

/** JPL "Approximate Positions of the Planets": elements at date, including Table 2b terms. */
export function elementsAt(table: ApproxTable, jdTdb: number): ApproxElements {
  const T = centuriesSinceJ2000(jdTdb);
  const el = table.elements;
  const r = table.ratesPerCentury;
  const a = el.a + r.a * T;
  const e = Math.min(Math.max(el.e + r.e * T, 0), 0.99); // clamp guards extrapolation far outside the fit
  const I = el.I + r.I * T;
  const L = el.L + r.L * T;
  const varpi = el.varpi + r.varpi * T;
  const Omega = el.Omega + r.Omega * T;
  let M = L - varpi;
  const x = table.extraTerms;
  if (x) M += x.b * T * T + x.c * Math.cos(x.f * T * DEG) + x.s * Math.sin(x.f * T * DEG);
  return {
    aKm: a * AU_KM,
    e,
    iRad: I * DEG,
    nodeRad: Omega * DEG,
    argPeriRad: (varpi - Omega) * DEG,
    meanAnomalyRad: normalizeDeg180(M) * DEG,
  };
}

export function planetApproxState(orbit: PlanetApproxOrbit, jdTdb: number): BodyState {
  const { table, inValidRange } = selectTable(orbit.tables, jdTdb);
  const el = elementsAt(table, jdTdb);
  const E = solveKeplerElliptic(el.meanAnomalyRad, el.e);
  return { positionKm: positionAtEccentricAnomaly(el, E), inValidRange, tableId: table.id };
}
