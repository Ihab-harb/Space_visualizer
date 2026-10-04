import { dot, type Vec3 } from '../math/vec3';

/** Fraction of the Sun's disc visible behind a spherical occluder (circle-overlap area; soft penumbra). */
export function sunVisibleFraction(sunAngularRadius: number, occluderAngularRadius: number, separation: number): number {
  const rs = sunAngularRadius;
  const ro = occluderAngularRadius;
  const d = separation;
  if (d >= rs + ro) return 1;
  if (d <= Math.abs(ro - rs)) return ro >= rs ? 0 : 1 - (ro * ro) / (rs * rs);
  const a1 = rs * rs * Math.acos((d * d + rs * rs - ro * ro) / (2 * d * rs));
  const a2 = ro * ro * Math.acos((d * d + ro * ro - rs * rs) / (2 * d * ro));
  const a3 = 0.5 * Math.sqrt((-d + rs + ro) * (d + rs - ro) * (d - rs + ro) * (d + rs + ro));
  return 1 - (a1 + a2 - a3) / (Math.PI * rs * rs);
}

/** Radius at which a ray meets the plane z = 0, or null if it never does going forward. */
export function rayPlaneRadius(origin: Vec3, dir: Vec3): number | null {
  if (Math.abs(dir[2]) < 1e-12) return null;
  const t = -origin[2] / dir[2];
  if (t <= 0) return null;
  return Math.hypot(origin[0] + t * dir[0], origin[1] + t * dir[1]);
}

/** Forward ray hit on an ellipsoid with equatorial radius 1 and polar radius `flattening`. */
export function rayHitsEllipsoid(origin: Vec3, dir: Vec3, flattening: number): boolean {
  const o: Vec3 = [origin[0], origin[1], origin[2] / flattening];
  const d: Vec3 = [dir[0], dir[1], dir[2] / flattening];
  const a = dot(d, d);
  const b = dot(o, d);
  const c = dot(o, o) - 1;
  const disc = b * b - a * c;
  if (disc < 0) return false;
  return (-b + Math.sqrt(disc)) / a > 0 && (-b - Math.sqrt(disc)) / a > 1e-9;
}
