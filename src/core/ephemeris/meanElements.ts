import type { SatelliteOrbit } from '../catalog/schema';
import { DEG, normalizeDeg180 } from '../math/angles';
import type { Vec3 } from '../math/vec3';
import { positionAtEccentricAnomaly } from './conic';
import { solveKeplerElliptic } from './kepler';

const DAYS_PER_YEAR = 365.25;

export interface MeanElementAngles {
  /** Longitude of the ascending node, degrees (unwrapped). */
  nodeDeg: number;
  /** Longitude of perigee, degrees (unwrapped). */
  varpiDeg: number;
  /** Mean longitude, degrees (unwrapped). */
  lambdaDeg: number;
  /** Mean anomaly, degrees, in [-180, 180]. */
  meanAnomalyDeg: number;
  /** Argument of perigee, degrees. */
  argPeriDeg: number;
}

/**
 * The angles at a date. The node regresses and the apsis advances linearly with their stated
 * periods; the mean longitude moves at the sidereal rate.
 */
export function meanElementAnglesAt(m: SatelliteOrbit['meanElements'], jdTdb: number): MeanElementAngles {
  const dt = jdTdb - m.epochJdTdb;
  const nodeDeg = m.nodeDeg - (360 * dt) / (m.nodePeriodYears * DAYS_PER_YEAR);
  const varpiDeg = m.nodeDeg + m.argPeriDeg + (360 * dt) / (m.apsisPeriodYears * DAYS_PER_YEAR);
  const lambdaDeg = m.nodeDeg + m.argPeriDeg + m.meanAnomalyDeg + (360 * dt) / m.siderealPeriodDays;
  return {
    nodeDeg,
    varpiDeg,
    lambdaDeg,
    meanAnomalyDeg: normalizeDeg180(lambdaDeg - varpiDeg),
    argPeriDeg: varpiDeg - nodeDeg,
  };
}

/** Geocentric (parent-centred) ecliptic J2000 position from JPL satellite mean elements. */
export function meanElementsGeocentricKm(m: SatelliteOrbit['meanElements'], jdTdb: number): Vec3 {
  const a = meanElementAnglesAt(m, jdTdb);
  const E = solveKeplerElliptic(a.meanAnomalyDeg * DEG, m.e);
  return positionAtEccentricAnomaly(
    { aKm: m.aKm, e: m.e, iRad: m.iDeg * DEG, nodeRad: a.nodeDeg * DEG, argPeriRad: a.argPeriDeg * DEG },
    E,
  );
}
