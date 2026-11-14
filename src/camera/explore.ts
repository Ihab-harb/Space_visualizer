import { DEG } from '../core/math/angles';
import type { Vec3 } from '../core/math/vec3';
import type { InputDeltas } from './types';

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

/**
 * Half-height (body radii) of a drawn model that still fits at the entry framing with room for the top switch and the bottom
 * strip. The whole body (1) fits with room to spare; a taller Exploded stack makes the camera step back (Task 8).
 */
export const EXPLORE_FIT_HALF_HEIGHT = 1.05;

/**
 * How far to step the camera back (a factor on its distance from the look-at point) so a model of `halfHeightRadii` fits as
 * well as the whole body does. 1 when it already fits; a portrait phone, framed from further back, needs less.
 */
export function exploreFitScale(halfHeightRadii: number, fovRad: number, aspect: number): number {
  if (!(halfHeightRadii > 0)) return 1;
  const entry = exploreFrameRadii(fovRad, aspect);
  return Math.max(1, ((halfHeightRadii / EXPLORE_FIT_HALF_HEIGHT) * EXPLORE_CAMERA.frameRadii) / entry);
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

/** Explore's camera input: orbit and zoom only. Pan is dropped, so the body stays centre stage (spec §3.3). */
export function exploreInput(d: InputDeltas): InputDeltas {
  return { ...d, panX: 0, panY: 0 };
}

/**
 * The orbit distance after the screen's aspect changes in Explore (a phone turned). When the new shape needs more room than the
 * old one (landscape to portrait), its entry framing becomes a floor, so the whole body fits again; a user who zoomed out
 * further keeps their distance. A change that needs no more room keeps the user's zoom.
 */
export function reframeDistanceKm(distanceKm: number, radiusKm: number, fovRad: number, prevAspect: number, aspect: number): number {
  const need = exploreFrameRadii(fovRad, aspect);
  if (need <= exploreFrameRadii(fovRad, prevAspect) + 1e-9) return distanceKm;
  return Math.max(distanceKm, radiusKm * need);
}
