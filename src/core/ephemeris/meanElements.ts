import type { SatelliteOrbit } from '../catalog/schema';
import { DEG, normalizeDeg180 } from '../math/angles';
import type { Vec3 } from '../math/vec3';
import { positionAtEccentricAnomaly } from './conic';
import { solveKeplerElliptic } from './kepler';

const DAYS_PER_YEAR = 365.25;

/**
 * Geocentric (parent-centred) ecliptic J2000 position from JPL satellite mean elements.
 * The node regresses and the apsis advances linearly with their stated periods; the
 * mean longitude moves at the sidereal rate.
 */
export function meanElementsGeocentricKm(m: SatelliteOrbit['meanElements'], jdTdb: number): Vec3 {
  const dt = jdTdb - m.epochJdTdb;
  const node = m.nodeDeg - (360 * dt) / (m.nodePeriodYears * DAYS_PER_YEAR);
  const varpi = m.nodeDeg + m.argPeriDeg + (360 * dt) / (m.apsisPeriodYears * DAYS_PER_YEAR);
  const lambda = m.nodeDeg + m.argPeriDeg + m.meanAnomalyDeg + (360 * dt) / m.siderealPeriodDays;
  const M = normalizeDeg180(lambda - varpi);
  const omega = varpi - node;
  const E = solveKeplerElliptic(M * DEG, m.e);
  return positionAtEccentricAnomaly(
    { aKm: m.aKm, e: m.e, iRad: m.iDeg * DEG, nodeRad: node * DEG, argPeriRad: omega * DEG },
    E,
  );
}
