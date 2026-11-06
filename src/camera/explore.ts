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
  tiltRad: -22 * DEG,
} as const;

/** Screen-up of an orbit view at (azimuth, elevation) about ecliptic north: the explode axis captured at entry. */
export function orbitUp(azimuthRad: number, elevationRad: number): Vec3 {
  const se = Math.sin(elevationRad);
  return [-se * Math.cos(azimuthRad), -se * Math.sin(azimuthRad), Math.cos(elevationRad)];
}

/** Half the body's width the framing keeps in view, in body radii (the body plus a little room either side). */
const FIT_HALF_WIDTH_RADII = 1.2;

/**
 * Entry distance in body radii for a vertical field of view and a screen aspect (width / height). Landscape screens keep
 * FRAME_RADII; a portrait phone moves back until the body's whole width fits (spec §3.3: the whole body in view).
 */
export function exploreFrameRadii(fovRad: number, aspect: number): number {
  if (!(aspect > 0) || !(fovRad > 0)) return EXPLORE_CAMERA.frameRadii;
  const fit = FIT_HALF_WIDTH_RADII / (Math.tan(fovRad / 2) * aspect);
  return Math.min(EXPLORE_CAMERA.maxRadii, Math.max(EXPLORE_CAMERA.frameRadii, fit));
}
