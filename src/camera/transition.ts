import { add, length, lerp, normalize, scale, slerpDirection, sub } from '../core/math/vec3';
import type { CameraPose } from './types';

export const TRANSITION_SECONDS = 1.6;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Fly from one pose to another. Distance to the destination is interpolated in log space so a jump
 * from 10 AU to 300 000 km looks smooth; the gaze reaches the destination by the halfway point.
 */
export function interpolatePose(from: CameraPose, to: CameraPose, s: number): CameraPose {
  const t = easeInOutCubic(Math.min(1, Math.max(0, s)));
  const fromOffset = sub(from.positionKm, to.lookAtKm);
  const toOffset = sub(to.positionKm, to.lookAtKm);
  const d0 = Math.max(length(fromOffset), 1e-6);
  const d1 = Math.max(length(toOffset), 1e-6);
  const distance = Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * t);
  const direction = slerpDirection(normalize(fromOffset), normalize(toOffset), t);
  return {
    positionKm: t >= 1 ? to.positionKm : add(to.lookAtKm, scale(direction, distance)),
    lookAtKm: lerp(from.lookAtKm, to.lookAtKm, Math.min(1, 2 * t)),
  };
}
