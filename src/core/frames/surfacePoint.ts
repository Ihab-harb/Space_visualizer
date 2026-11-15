import type { Vec3 } from '../math/vec3';

const DEG = Math.PI / 180;

/** Unit body-fixed direction of a planetographic point (longitude east). Matches the rotated unit SphereGeometry and uvForLonLat. */
export function surfaceDirection(latDeg: number, lonDegE: number): Vec3 {
  const lat = latDeg * DEG;
  const lon = lonDegE * DEG;
  const c = Math.cos(lat);
  return [c * Math.cos(lon), c * Math.sin(lon), Math.sin(lat)];
}

/** Point on the body in body radii. `flattening` is polar radius over equatorial radius. */
export function surfacePoint(latDeg: number, lonDegE: number, flattening: number): Vec3 {
  const d = surfaceDirection(latDeg, lonDegE);
  return [d[0], d[1], flattening * d[2]];
}
