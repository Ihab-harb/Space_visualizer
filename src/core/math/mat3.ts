import type { Vec3 } from './vec3';

/** Row-major 3x3 matrix. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
    }
  }
  return r as unknown as Mat3;
}

export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Passive rotation of the coordinate frame about x by theta (radians). */
export function rotX(theta: number): Mat3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [1, 0, 0, 0, c, s, 0, -s, c];
}

/** Passive rotation of the coordinate frame about z by theta (radians). */
export function rotZ(theta: number): Mat3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [c, s, 0, -s, c, 0, 0, 0, 1];
}

export function fromColumns(x: Vec3, y: Vec3, z: Vec3): Mat3 {
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

export function column(m: Mat3, i: 0 | 1 | 2): Vec3 {
  return [m[i], m[3 + i], m[6 + i]];
}
