import { describe, expect, it } from 'vitest';
import { cross, dot, length, normalize, sub } from '../core/math/vec3';
import { lookRotation } from './rig';
import { offsetDirection, orbitPose } from './orbitController';
import { EXPLORE_CAMERA, EXPLORE_FIT_HALF_HEIGHT, exploreFitScale, exploreFrameRadii, exploreInput, orbitUp, reframeDistanceKm } from './explore';

describe('orbitUp', () => {
  it('is the screen-up of the orbit view: unit, across the view direction, and equal to the camera up column', () => {
    for (const [az, el] of [[0, 0], [1, 0.4], [-2, -0.7], [3, 1.2]] as const) {
      const up = orbitUp(az, el);
      expect(length(up)).toBeCloseTo(1);
      expect(dot(up, offsetDirection(az, el))).toBeCloseTo(0);
      const pose = orbitPose({ targetId: 'x', distanceKm: 10, azimuthRad: az, elevationRad: el, panOffsetKm: [0, 0, 0] }, [0, 0, 0]);
      const m = lookRotation(pose.positionKm, pose.lookAtKm, pose.up);
      const cameraUp = [m[1], m[4], m[7]] as const;
      expect(dot(up, cameraUp)).toBeCloseTo(1);
      expect(length(cross(normalize(sub(pose.lookAtKm, pose.positionKm)), up))).toBeCloseTo(1);
    }
  });
});

describe('exploreFrameRadii', () => {
  const fov = (50 * Math.PI) / 180;
  it('keeps 3.4 radii on landscape and square-ish screens', () => {
    expect(exploreFrameRadii(fov, 1280 / 720)).toBe(EXPLORE_CAMERA.frameRadii);
    expect(exploreFrameRadii(fov, 800 / 1000)).toBe(EXPLORE_CAMERA.frameRadii);
  });
  it('moves back on a portrait phone so the whole body width fits, within the distance limit', () => {
    const d = exploreFrameRadii(fov, 390 / 844);
    const halfWidthRadii = Math.tan(fov / 2) * (390 / 844) * d;
    expect(halfWidthRadii).toBeGreaterThanOrEqual(1.15);
    expect(d).toBeLessThanOrEqual(EXPLORE_CAMERA.maxRadii);
  });
  it('falls back to 3.4 radii for a bad aspect', () => {
    expect(exploreFrameRadii(fov, 0)).toBe(EXPLORE_CAMERA.frameRadii);
    expect(exploreFrameRadii(fov, Number.NaN)).toBe(EXPLORE_CAMERA.frameRadii);
  });
});

describe('exploreFitScale', () => {
  const fov = (50 * Math.PI) / 180;
  const desktop = 1280 / 720;
  it('keeps the entry framing while the model is no taller than the body (Whole, Half-section)', () => {
    expect(exploreFitScale(1, fov, desktop)).toBe(1);
    expect(exploreFitScale(EXPLORE_FIT_HALF_HEIGHT, fov, desktop)).toBe(1);
  });
  it('steps back in proportion for a taller Exploded stack, so it fits as well as the body does', () => {
    const s = exploreFitScale(1.5, fov, desktop);
    expect(s).toBeCloseTo(1.5 / EXPLORE_FIT_HALF_HEIGHT, 10);
    // The visible half-height at the stepped-back distance, in model half-heights, matches the fitting model's.
    const visible = (scale: number) => Math.tan(fov / 2) * EXPLORE_CAMERA.frameRadii * scale;
    expect(visible(s) / 1.5).toBeCloseTo(visible(1) / EXPLORE_FIT_HALF_HEIGHT, 10);
  });
  it('a portrait phone, already framed from further back, steps back less or not at all', () => {
    expect(exploreFitScale(1.5, fov, 390 / 844)).toBeLessThan(exploreFitScale(1.5, fov, desktop));
    expect(exploreFitScale(1.5, fov, 390 / 844)).toBe(1);
  });
  it('is 1 for a missing or bad height', () => {
    expect(exploreFitScale(0, fov, desktop)).toBe(1);
    expect(exploreFitScale(Number.NaN, fov, desktop)).toBe(1);
  });
});

describe('exploreInput (orbit and zoom only)', () => {
  it('drops pan and keeps rotation and zoom', () => {
    expect(exploreInput({ rotateX: 3, rotateY: -2, panX: 40, panY: -12, zoom: 5 })).toEqual({ rotateX: 3, rotateY: -2, panX: 0, panY: 0, zoom: 5 });
  });
});

describe('reframeDistanceKm (the screen turned while exploring)', () => {
  const fov = (45 * Math.PI) / 180;
  const R = 6378;
  const wide = 844 / 390;
  const tall = 390 / 844;
  it('a turn to portrait moves the camera back to the portrait framing, so the whole body fits', () => {
    const landscape = R * exploreFrameRadii(fov, wide);
    const portrait = R * exploreFrameRadii(fov, tall);
    expect(portrait).toBeGreaterThan(landscape);
    expect(reframeDistanceKm(landscape, R, fov, wide, tall)).toBeCloseTo(portrait, 6);
    // Even from a zoomed-in camera: the new shape needs the room.
    expect(reframeDistanceKm(R * 1.5, R, fov, wide, tall)).toBeCloseTo(portrait, 6);
  });
  it('keeps a user who has zoomed out further', () => {
    expect(reframeDistanceKm(R * 8, R, fov, wide, tall)).toBe(R * 8);
  });
  it('does not pull the camera in on a turn back to landscape, nor undo a zoom when the new shape needs no more room', () => {
    const portrait = R * exploreFrameRadii(fov, tall);
    expect(reframeDistanceKm(portrait, R, fov, tall, wide)).toBe(portrait);
    expect(reframeDistanceKm(R * 1.5, R, fov, 16 / 9, 4 / 3)).toBe(R * 1.5);
  });
});
