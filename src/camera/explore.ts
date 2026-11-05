import { DEG } from '../core/math/angles';
import type { Vec3 } from '../core/math/vec3';

/**
 * Explore framing (spec §3.3, Task 6). On entry the camera keeps its direction, moves to FRAME_RADII body radii (the whole
 * body, exploded caps included, with room for labels) and drops TILT below the view it had, so the bases of the lifted caps
 * show (mockup B). Distance limits: the core is reachable at the closest (orbit's 1.2 radii floor), the whole body stays in
 * view at the widest.
 */
export const EXPLORE_CAMERA = {
  frameRadii: 3.4,
  maxRadii: 9,
  tiltRad: -12 * DEG,
} as const;

/** Screen-up of an orbit view at (azimuth, elevation) about ecliptic north: the explode axis captured at entry. */
export function orbitUp(azimuthRad: number, elevationRad: number): Vec3 {
  const se = Math.sin(elevationRad);
  return [-se * Math.cos(azimuthRad), -se * Math.sin(azimuthRad), Math.cos(elevationRad)];
}
