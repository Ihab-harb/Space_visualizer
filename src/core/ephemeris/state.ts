import type { Body } from '../catalog/schema';
import { planetApproxState, selectTable } from './planetApprox';
import type { BodyState } from './types';

export function bodyState(body: Body, jdTdb: number): BodyState {
  switch (body.orbit.type) {
    case 'fixed':
      return { positionKm: body.orbit.positionKm, inValidRange: true, tableId: null };
    case 'planet-approx':
      return planetApproxState(body.orbit, jdTdb);
  }
}

export type ValidityStatus = 'high' | 'extended' | 'out-of-range';

/** 'high' = every body uses its preferred table; 'extended' = some use a fallback table; 'out-of-range' = some are extrapolated. */
export function validityStatus(bodies: readonly Body[], jdTdb: number): ValidityStatus {
  let status: ValidityStatus = 'high';
  for (const body of bodies) {
    if (body.orbit.type !== 'planet-approx') continue;
    const selected = selectTable(body.orbit.tables, jdTdb);
    if (!selected.inValidRange) return 'out-of-range';
    if (selected.index > 0) status = 'extended';
  }
  return status;
}
