import { describe, expect, it } from 'vitest';
import { DEG } from '../core/math/angles';
import { apply, column, rotZ, transpose } from '../core/math/mat3';
import { dot, length, sub, type Vec3 } from '../core/math/vec3';
import { createFollowController, followPose } from './followController';
import { pinchToZoom, wheelToZoom } from './input';
import { applyOrbitInput, createOrbitController, MAX_DISTANCE_KM, MAX_ELEVATION_RAD, MIN_SURFACE_FACTOR, offsetDirection, orbitPose, type OrbitState } from './orbitController';
import { keepOutside, lookRotation } from './rig';
import { interpolatePose } from './transition';
import { NO_INPUT, type ControllerContext } from './types';

const finite = (v: Vec3) => v.every(Number.isFinite);
const base: OrbitState = { targetId: 'jupiter', distanceKm: 1e6, azimuthRad: 0, elevationRad: 0, panOffsetKm: [0, 0, 0] };
const ctx = (orientation = rotZ(0)): ControllerContext => ({
  bodyPosition: (id) => (id === 'jupiter' ? [7e8, 1e8, 0] : [0, 0, 0]),
  bodyRadiusKm: (id) => (id === 'jupiter' ? 71492 : 695700),
  bodyOrientation: () => orientation,
});

describe('lookRotation', () => {
  it('builds an orthonormal camera basis looking at the target', () => {
    const m = lookRotation([0, 0, 0], [0, 10, 0]);
    const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 12));
    close(column(m, 0), [1, 0, 0]); // right
    close(column(m, 1), [0, 0, 1]); // up
    close(column(m, 2), [0, -1, 0]); // back (camera looks down -Z)
  });
  it('stays finite when looking straight along the up axis or at its own position', () => {
    for (const m of [lookRotation([0, 0, 10], [0, 0, 0]), lookRotation([1, 2, 3], [1, 2, 3])]) {
      expect(m.every(Number.isFinite)).toBe(true);
      expect(length(column(m, 0))).toBeCloseTo(1, 12);
    }
  });
});

describe('orbit controller', () => {
  it('places the camera on a sphere around the target', () => {
    const pose = orbitPose({ ...base, distanceKm: 10 }, [100, 0, 0]);
    expect(pose).toEqual({ positionKm: [110, 0, 0], lookAtKm: [100, 0, 0] });
  });
  it('clamps zoom between the surface margin and the maximum distance', () => {
    expect(applyOrbitInput(base, { ...NO_INPUT, zoom: -1e6 }, 71492).distanceKm).toBeCloseTo(71492 * MIN_SURFACE_FACTOR, 6);
    expect(applyOrbitInput(base, { ...NO_INPUT, zoom: 1e6 }, 71492).distanceKm).toBe(MAX_DISTANCE_KM);
  });
  it('clamps elevation short of the poles', () => {
    expect(applyOrbitInput(base, { ...NO_INPUT, rotateY: 1e6 }, 1).elevationRad).toBe(MAX_ELEVATION_RAD);
    expect(applyOrbitInput(base, { ...NO_INPUT, rotateY: -1e6 }, 1).elevationRad).toBe(-MAX_ELEVATION_RAD);
  });
  it('pans perpendicular to the viewing direction', () => {
    const s = applyOrbitInput({ ...base, azimuthRad: 0.7, elevationRad: 0.3 }, { ...NO_INPUT, panX: 40, panY: -25 }, 1);
    expect(length(s.panOffsetKm)).toBeGreaterThan(0);
    expect(dot(s.panOffsetKm, offsetDirection(0.7, 0.3))).toBeCloseTo(0, 6);
  });
  it('never puts the camera inside the target body', () => {
    const c = createOrbitController({ ...base, distanceKm: 10 });
    const pose = c.update({ ...NO_INPUT, zoom: -1e6 }, ctx());
    expect(length(sub(pose.positionKm, [7e8, 1e8, 0]))).toBeGreaterThanOrEqual(71492 * MIN_SURFACE_FACTOR - 1e-6);
  });
  it('focus moves the pivot to a new body and clears panning', () => {
    const c = createOrbitController({ ...base, targetId: 'sun', panOffsetKm: [5, 5, 5] });
    c.focus('jupiter', ctx());
    expect(c.getState()).toMatchObject({ targetId: 'jupiter', panOffsetKm: [0, 0, 0], distanceKm: 71492 * 6 });
  });
  it('enter adopts the current camera position for a seamless switch', () => {
    const c = createOrbitController(base);
    c.enter({ positionKm: [7e8, 1e8, 5e5], lookAtKm: [7e8, 1e8, 0] }, ctx());
    expect(c.getState().distanceKm).toBeCloseTo(5e5, 3);
    expect(c.getState().elevationRad).toBeCloseTo(MAX_ELEVATION_RAD, 9);
  });
});

describe('follow controller', () => {
  it('rotates the offset with the body when co-rotating', () => {
    const orientation = rotZ(-90 * DEG); // body x axis -> ecliptic +y
    const pose = followPose({ targetId: 'jupiter', distanceKm: 10, azimuthRad: 0, elevationRad: 0, coRotate: true }, [0, 0, 0], orientation);
    const expected = apply(orientation, [10, 0, 0]);
    pose.positionKm.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 9));
  });
  it('toggling co-rotation keeps the camera where it is', () => {
    const orientation = transpose(rotZ(0.8));
    const c = createFollowController({ targetId: 'jupiter', distanceKm: 3e5, azimuthRad: 0.3, elevationRad: 0.2, coRotate: false });
    const before = c.update(NO_INPUT, ctx(orientation));
    c.setCoRotate(true, ctx(orientation));
    const after = c.update(NO_INPUT, ctx(orientation));
    after.positionKm.forEach((v, i) => expect(v).toBeCloseTo(before.positionKm[i]!, 3));
  });
  it('setTarget frames the body at four radii', () => {
    const c = createFollowController({ targetId: 'sun', distanceKm: 1, azimuthRad: 0, elevationRad: 0, coRotate: false });
    c.setTarget('jupiter', ctx());
    expect(c.getState()).toMatchObject({ targetId: 'jupiter', distanceKm: 71492 * 4 });
  });
});

describe('transitions', () => {
  const from = { positionKm: [1e9, 0, 0] as Vec3, lookAtKm: [0, 0, 0] as Vec3 };
  const to = { positionKm: [7e8 + 3e5, 1e8, 0] as Vec3, lookAtKm: [7e8, 1e8, 0] as Vec3 };
  it('starts at "from" and ends at "to"', () => {
    const start = interpolatePose(from, to, 0);
    const end = interpolatePose(from, to, 1);
    start.positionKm.forEach((v, i) => expect(v).toBeCloseTo(from.positionKm[i]!, 0));
    expect(start.lookAtKm).toEqual(from.lookAtKm);
    end.positionKm.forEach((v, i) => expect(v).toBeCloseTo(to.positionKm[i]!, 0));
    expect(end.lookAtKm).toEqual(to.lookAtKm);
  });
  it('shrinks the distance to the destination monotonically (log interpolation)', () => {
    const d = [0.25, 0.5, 0.75].map((s) => length(sub(interpolatePose(from, to, s).positionKm, to.lookAtKm)));
    expect(d[0]!).toBeGreaterThan(d[1]!);
    expect(d[1]!).toBeGreaterThan(d[2]!);
  });
  it('is finite for identical poses', () => {
    const p = interpolatePose(to, to, 0.5);
    expect(finite(p.positionKm) && finite(p.lookAtKm)).toBe(true);
  });
});

describe('rig helpers and input mapping', () => {
  it('pushes a pose out of a body', () => {
    const pose = keepOutside({ positionKm: [1, 0, 0], lookAtKm: [0, 0, 0] }, [0, 0, 0], 10);
    expect(pose.positionKm).toEqual([10, 0, 0]);
    expect(keepOutside({ positionKm: [0, 0, 0], lookAtKm: [0, 0, 0] }, [0, 0, 0], 10).positionKm).toEqual([0, 0, 10]);
  });
  it('maps wheel and pinch to zoom', () => {
    expect(wheelToZoom(100, 0)).toBe(100);
    expect(wheelToZoom(3, 1)).toBe(48);
    expect(pinchToZoom(100, 150)).toBeLessThan(0); // fingers apart = zoom in
  });
});
