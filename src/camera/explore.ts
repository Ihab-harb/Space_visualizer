import { DEG } from '../core/math/angles';
import type { Vec3 } from '../core/math/vec3';
import type { InputDeltas } from './types';
import { litAzimuth } from './tour';

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

/** Seconds the view takes to turn to a selected surface feature. */
export const FEATURE_TURN_SECONDS = 0.8;
/** A polar feature is viewed from 70 degrees, not from straight above (the orbit's up is ecliptic north). */
export const FEATURE_MAX_ELEVATION_RAD = (70 * Math.PI) / 180;

interface OrbitAngles {
  azimuthRad: number;
  elevationRad: number;
}

/** Entry azimuth: the sunlit side (the tour's lit azimuth), or the current one for the Sun itself or with no Sun. */
export function exploreEntryAzimuth(bodyId: string, sunId: string | null, bodyKm: Vec3, sunKm: Vec3, currentAzimuthRad: number): number {
  if (sunId === null || bodyId === sunId) return currentAzimuthRad;
  return litAzimuth(bodyKm, sunKm);
}

/** The camera angles that look straight at a point on the body, given its unit direction in world axes. */
export function featureView(directionWorld: Vec3): OrbitAngles {
  const elevation = Math.asin(Math.min(1, Math.max(-1, directionWorld[2])));
  return {
    azimuthRad: Math.atan2(directionWorld[1], directionWorld[0]),
    elevationRad: Math.min(FEATURE_MAX_ELEVATION_RAD, Math.max(-FEATURE_MAX_ELEVATION_RAD, elevation)),
  };
}

/** The view at eased progress t (0..1); the azimuth takes the short way round. Exactly `to` at t >= 1. */
export function turnStep(from: OrbitAngles, to: OrbitAngles, t: number): OrbitAngles {
  if (t >= 1) return { azimuthRad: to.azimuthRad, elevationRad: to.elevationRad };
  const u = Math.max(0, t);
  const e = u * u * (3 - 2 * u);
  const TAU = 2 * Math.PI;
  let d = (to.azimuthRad - from.azimuthRad) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return { azimuthRad: from.azimuthRad + d * e, elevationRad: from.elevationRad + (to.elevationRad - from.elevationRad) * e };
}

export interface FeatureTurn {
  from: OrbitAngles;
  to: OrbitAngles;
  startedAt: number;
  seq: number;
}

/**
 * One frame of the turn: the next turn (null when done or cancelled) and the view to apply (null for no change).
 * Input cancels the turn and leaves the view to the user; reduced motion cuts to the target.
 */
export function advanceTurn(turn: FeatureTurn | null, nowSeconds: number, hasInput: boolean, reducedMotion: boolean): { turn: FeatureTurn | null; view: OrbitAngles | null } {
  if (!turn || hasInput) return { turn: null, view: null };
  if (reducedMotion) return { turn: null, view: turnStep(turn.from, turn.to, 1) };
  const t = (nowSeconds - turn.startedAt) / FEATURE_TURN_SECONDS;
  if (t >= 1) return { turn: null, view: turnStep(turn.from, turn.to, 1) };
  return { turn, view: turnStep(turn.from, turn.to, t) };
}
