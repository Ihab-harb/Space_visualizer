import type { Matrix4 } from 'three';
import type { Mat3 } from '../core/math/mat3';

export function writeMatrix4(m: Mat3, target: Matrix4): Matrix4 {
  return target.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
}
