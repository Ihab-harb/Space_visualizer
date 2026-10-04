import { fromColumns, type Mat3 } from '../core/math/mat3';
import { add, cross, length, normalize, scale, sub, type Vec3 } from '../core/math/vec3';
import type { CameraPose } from './types';

/** Camera-to-world rotation. Columns: right, up, back (Three.js cameras look down their local -Z). */
export function lookRotation(positionKm: Vec3, lookAtKm: Vec3, up: Vec3 = [0, 0, 1]): Mat3 {
  let forward = normalize(sub(lookAtKm, positionKm));
  if (length(forward) === 0) forward = [0, 1, 0];
  let right = cross(forward, up);
  if (length(right) < 1e-9) right = cross(forward, [0, 1, 0]);
  right = normalize(right);
  const cameraUp = cross(right, forward);
  return fromColumns(right, cameraUp, scale(forward, -1));
}

export function keepOutside(pose: CameraPose, centerKm: Vec3, minDistanceKm: number): CameraPose {
  const offset = sub(pose.positionKm, centerKm);
  const d = length(offset);
  if (d >= minDistanceKm) return pose;
  const direction: Vec3 = d === 0 ? [0, 0, 1] : scale(offset, 1 / d);
  return { ...pose, positionKm: add(centerKm, scale(direction, minDistanceKm)) };
}
