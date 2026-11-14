import { describe, expect, it } from 'vitest';
import { length, sub, type Vec3 } from '../core/math/vec3';
import { makeEarth, makeJupiter, makeSun } from '../test/fixtures';
import { buildTour, litAzimuth, stopPose, TOUR, tourPhase } from './tour';
import type { ControllerContext } from './types';

const bodies = [makeJupiter(), makeSun(), makeEarth()];

describe('tour', () => {
  it('visits the Sun, the planets outward, then the overview', () => {
    const stops = buildTour(bodies);
    expect(stops.map((s) => s.selectId)).toEqual(['sun', 'earth', 'jupiter', null]);
    expect(stops.at(-1)!.distanceKm).toBe(TOUR.overviewDistanceKm);
    expect(stops[1]!.distanceKm).toBeCloseTo(makeEarth().shape.equatorialRadiusKm * TOUR.distanceRadii, 6);
  });
  it('alternates flight and dwell for each stop, then ends', () => {
    const per = TOUR.flightS + TOUR.dwellS;
    expect(tourPhase(4, 0)).toEqual({ index: 0, phase: 'flight', t: 0 });
    expect(tourPhase(4, TOUR.flightS + TOUR.dwellS / 2)).toEqual({ index: 0, phase: 'dwell', t: 0.5 });
    expect(tourPhase(4, per * 2 + 1)!.index).toBe(2);
    expect(tourPhase(4, per * 4)).toBeNull();
  });
  it('places the camera at the stop distance on the sunlit side', () => {
    const body: Vec3 = [1.5e8, 0, 0];
    const sun: Vec3 = [0, 0, 0];
    const ctx: ControllerContext = { bodyPosition: (id) => (id === 'earth' ? body : sun), bodyRadiusKm: () => 6378, bodyOrientation: () => undefined };
    const stop = buildTour(bodies)[1]!;
    const pose = stopPose(stop, ctx, litAzimuth(body, sun))!;
    expect(length(sub(pose.positionKm, body))).toBeCloseTo(stop.distanceKm, 3);
    expect(pose.positionKm[0]).toBeLessThan(body[0]); // camera between the body and the Sun: lit side
  });
});
