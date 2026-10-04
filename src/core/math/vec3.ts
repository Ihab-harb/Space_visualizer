export type Vec3 = readonly [number, number, number];

export const ZERO: Vec3 = [0, 0, 0];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b));
}
export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l === 0 ? ZERO : scale(a, 1 / l);
}
export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
/** Angle in radians; atan2 form stays accurate for tiny and near-pi angles. */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}
/** Spherical interpolation between unit vectors. */
export function slerpDirection(a: Vec3, b: Vec3, t: number): Vec3 {
  const angle = angleBetween(a, b);
  if (angle < 1e-9) return normalize(lerp(a, b, t));
  if (Math.PI - angle < 1e-6) {
    const axis = normalize(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0]));
    const theta = angle * t;
    return normalize(add(scale(a, Math.cos(theta)), scale(cross(axis, a), Math.sin(theta))));
  }
  const s = Math.sin(angle);
  return normalize(add(scale(a, Math.sin((1 - t) * angle) / s), scale(b, Math.sin(t * angle) / s)));
}
