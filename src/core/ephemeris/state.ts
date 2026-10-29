import type { Body } from '../catalog/schema';
import { planetApproxState, selectTable } from './planetApprox';
import type { BodyState } from './types';

export function bodyState(body: Body, jdTdb: number): BodyState {
  switch (body.orbit.type) {
    case 'fixed':
      return { positionKm: body.orbit.positionKm, inValidRange: true, tableId: null };
    case 'planet-approx':
      return planetApproxState(body.orbit, jdTdb);
    case 'satellite':
      throw new Error('use systemState for satellite bodies');
  }
}

export type ValidityStatus = 'high' | 'extended' | 'out-of-range';

/**
 * 'high' = every body uses its preferred table; 'extended' = some planets use a fallback table;
 * 'out-of-range' = some planet is extrapolated, or a satellite is outside its table and on mean elements.
 */
export function validityStatus(bodies: readonly Body[], jdTdb: number): ValidityStatus {
  let status: ValidityStatus = 'high';
  for (const body of bodies) {
    if (body.orbit.type === 'satellite') {
      const o = body.orbit;
      if (jdTdb >= o.table.validFromJdTdb && jdTdb <= o.table.validToJdTdb) continue;
      // A satellite on its mean elements (outside its table) is far less accurate than 'extended' implies (spec §3.2).
      return 'out-of-range';
    }
    if (body.orbit.type !== 'planet-approx') continue;
    const selected = selectTable(body.orbit.tables, jdTdb);
    if (!selected.inValidRange) return 'out-of-range';
    if (selected.index > 0) status = 'extended';
  }
  return status;
}
