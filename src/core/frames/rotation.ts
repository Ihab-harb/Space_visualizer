import { DEG, normalizeDeg360 } from '../math/angles';
import { apply, column, mul, rotX, rotZ, transpose, type Mat3 } from '../math/mat3';
import type { Vec3 } from '../math/vec3';
import { DAYS_PER_JULIAN_CENTURY, J2000_JD, OBLIQUITY_J2000_DEG } from '../units';

export interface RotationTerms {
  poleRa: readonly [number, number, number];
  poleDec: readonly [number, number, number];
  pm: readonly [number, number, number];
  nutPrecRa: readonly number[];
  nutPrecDec: readonly number[];
  nutPrecPm: readonly number[];
  nutPrecAngles: ReadonlyArray<readonly [number, number, number]>;
}

const poly = (c: readonly [number, number, number], x: number) => c[0] + c[1] * x + c[2] * x * x;

/** IAU WGCCRE pole right ascension/declination and prime meridian angle, degrees. */
export function orientationAngles(model: RotationTerms, jdTdb: number): { raDeg: number; decDeg: number; wDeg: number } {
  const d = jdTdb - J2000_JD;
  const T = d / DAYS_PER_JULIAN_CENTURY;
  let ra = poly(model.poleRa, T);
  let dec = poly(model.poleDec, T);
  let w = poly(model.pm, d);
  model.nutPrecAngles.forEach((angle, k) => {
    const theta = poly(angle, T) * DEG;
    ra += (model.nutPrecRa[k] ?? 0) * Math.sin(theta);
    dec += (model.nutPrecDec[k] ?? 0) * Math.cos(theta);
    w += (model.nutPrecPm[k] ?? 0) * Math.sin(theta);
  });
  return { raDeg: ra, decDeg: dec, wDeg: normalizeDeg360(w) };
}

/** Columns are the body-fixed axes expressed in the ICRF (J2000 equatorial) frame. */
export function bodyFixedToEquatorial(model: RotationTerms, jdTdb: number): Mat3 {
  const { raDeg, decDeg, wDeg } = orientationAngles(model, jdTdb);
  const equatorialToBodyFixed = mul(rotZ(wDeg * DEG), mul(rotX((90 - decDeg) * DEG), rotZ((90 + raDeg) * DEG)));
  return transpose(equatorialToBodyFixed);
}

/** v_equatorial = ECLIPTIC_TO_EQUATORIAL * v_ecliptic. */
const ECLIPTIC_TO_EQUATORIAL: Mat3 = rotX(-OBLIQUITY_J2000_DEG * DEG);
const EQUATORIAL_TO_ECLIPTIC: Mat3 = transpose(ECLIPTIC_TO_EQUATORIAL);

export function eclipticToEquatorial(v: Vec3): Vec3 {
  return apply(ECLIPTIC_TO_EQUATORIAL, v);
}

export function equatorialToEcliptic(v: Vec3): Vec3 {
  return apply(EQUATORIAL_TO_ECLIPTIC, v);
}

/** Columns are the body-fixed axes expressed in the ecliptic J2000 frame (the scene's world frame). */
export function bodyFixedToEcliptic(model: RotationTerms, jdTdb: number): Mat3 {
  return mul(EQUATORIAL_TO_ECLIPTIC, bodyFixedToEquatorial(model, jdTdb));
}

export function poleEcliptic(model: RotationTerms, jdTdb: number): Vec3 {
  return column(bodyFixedToEcliptic(model, jdTdb), 2);
}
