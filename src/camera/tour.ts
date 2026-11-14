import type { Body } from '../core/catalog/schema';
import { DEG } from '../core/math/angles';
import type { Vec3 } from '../core/math/vec3';
import { orbitPose } from './orbitController';
import type { CameraPose, ControllerContext } from './types';

export const TOUR = {
  flightS: 5,
  dwellS: 7,
  orbitRadPerS: 4 * DEG,
  elevationRad: 14 * DEG,
  distanceRadii: 6,
  sunDistanceRadii: 10,
  overviewDistanceKm: 2.2e9,
  overviewElevationRad: 30 * DEG,
  litOffsetRad: 35 * DEG,
} as const;

export interface TourStop {
  targetId: string;
  /** The body to select at this stop (the header headline changes); null deselects for the overview. */
  selectId: string | null;
  distanceKm: number;
  elevationRad: number;
}

const semiMajorAxis = (b: Body) => {
  const v = b.facts.semiMajorAxisAu?.value;
  return typeof v === 'number' ? v : Number.POSITIVE_INFINITY;
};

export function buildTour(bodies: readonly Body[]): TourStop[] {
  const sun = bodies.find((b) => b.category === 'star');
  if (!sun) return [];
  const planets = bodies.filter((b) => b.category === 'planet').sort((a, b) => semiMajorAxis(a) - semiMajorAxis(b));
  return [
    { targetId: sun.id, selectId: sun.id, distanceKm: sun.shape.equatorialRadiusKm * TOUR.sunDistanceRadii, elevationRad: TOUR.elevationRad },
    ...planets.map((p) => ({ targetId: p.id, selectId: p.id, distanceKm: p.shape.equatorialRadiusKm * TOUR.distanceRadii, elevationRad: TOUR.elevationRad })),
    { targetId: sun.id, selectId: null, distanceKm: TOUR.overviewDistanceKm, elevationRad: TOUR.overviewElevationRad },
  ];
}

export function tourPhase(stopCount: number, elapsedS: number): { index: number; phase: 'flight' | 'dwell'; t: number } | null {
  const per = TOUR.flightS + TOUR.dwellS;
  const e = Math.max(0, elapsedS);
  const index = Math.floor(e / per);
  if (index >= stopCount) return null;
  const local = e - index * per;
  return local < TOUR.flightS ? { index, phase: 'flight', t: local / TOUR.flightS } : { index, phase: 'dwell', t: (local - TOUR.flightS) / TOUR.dwellS };
}

/** Camera azimuth on the sunlit side of a body (toward the Sun, offset so the terminator shows). */
export function litAzimuth(bodyKm: Vec3, sunKm: Vec3): number {
  return Math.atan2(sunKm[1] - bodyKm[1], sunKm[0] - bodyKm[0]) + TOUR.litOffsetRad;
}

export function stopPose(stop: TourStop, ctx: ControllerContext, azimuthRad: number): CameraPose | null {
  const target = ctx.bodyPosition(stop.targetId);
  if (!target) return null;
  return orbitPose({ targetId: stop.targetId, distanceKm: stop.distanceKm, azimuthRad, elevationRad: stop.elevationRad, panOffsetKm: [0, 0, 0] }, target);
}
