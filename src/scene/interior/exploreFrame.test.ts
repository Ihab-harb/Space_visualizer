import { describe, expect, it } from 'vitest';
import { dot, length, type Vec3 } from '../../core/math/vec3';
import type { DrawnLayer } from '../../core/interior/geometry';
import { cutAmounts, drawnExtent, EXPLORE_DIM, exploreShellUniforms, layerAtRadius, rayHitShell, sectionNormal, type ExploreFrame } from './exploreFrame';

const layer = (id: string, outer: number, inner: number): DrawnLayer => ({
  id, name: id, outer, inner, outerBand: 0, innerBand: 0, thickened: false, sizeKind: 'cited', state: 'solid', gradual: false,
});
const earth = [layer('crust', 1, 0.988), layer('mantle', 0.988, 0.547), layer('outer-core', 0.547, 0.192), layer('inner-core', 0.192, 0)];

describe('sectionNormal', () => {
  it('is a unit vector across the explode axis, turned by the yaw from the camera direction', () => {
    const up: Vec3 = [0, 0, 1];
    const n = sectionNormal([1, 0, 0.3], up, 0);
    expect(n[0]).toBeCloseTo(1);
    expect(dot(n, up)).toBeCloseTo(0);
    const yawed = sectionNormal([1, 0, 0.3], up, Math.PI / 6);
    expect(length(yawed)).toBeCloseTo(1);
    expect(dot(yawed, up)).toBeCloseTo(0);
    expect(dot(yawed, [1, 0, 0])).toBeCloseTo(Math.cos(Math.PI / 6));
  });

  it('falls back to a perpendicular when the camera looks along the axis', () => {
    const n = sectionNormal([0, 0, 1], [0, 0, 1], 0.4);
    expect(length(n)).toBeCloseTo(1);
    expect(dot(n, [0, 0, 1])).toBeCloseTo(0);
  });
});

describe('cutAmounts', () => {
  it('Whole never cuts or explodes', () => {
    expect(cutAmounts('whole', 1)).toEqual({ cut: 0, explode: 0 });
  });
  it('Half-section slices from the front with progress and never explodes', () => {
    expect(cutAmounts('section', 0)).toEqual({ cut: 0, explode: 0 });
    expect(cutAmounts('section', 0.5).cut).toBeCloseTo(0.5);
    expect(cutAmounts('section', 1)).toEqual({ cut: 1, explode: 0 });
  });
  it('Exploded opens the shells first, then lifts them; both complete at 1', () => {
    const early = cutAmounts('exploded', 0.2);
    expect(early.cut).toBeGreaterThan(early.explode);
    expect(cutAmounts('exploded', 0)).toEqual({ cut: 0, explode: 0 });
    expect(cutAmounts('exploded', 1)).toEqual({ cut: 1, explode: 1 });
  });
});

describe('drawnExtent', () => {
  it('is the unit body when closed', () => {
    expect(drawnExtent(earth, [0, 0, 0, 0], 0)).toEqual({ bottom: -1, top: 1 });
  });
  it('spans from the innermost layer to the highest lifted cap when exploded', () => {
    const e = drawnExtent(earth, [0.8, 0.53, 0.27, 0], 1);
    expect(e.top).toBeCloseTo(1.8);
    expect(e.bottom).toBeCloseTo(-0.192);
  });
});

describe('layerAtRadius', () => {
  it('finds the layer whose shell holds the radius', () => {
    expect(layerAtRadius(earth, 0.995)).toBe('crust');
    expect(layerAtRadius(earth, 0.6)).toBe('mantle');
    expect(layerAtRadius(earth, 0.1)).toBe('inner-core');
    expect(layerAtRadius(earth, 0)).toBe('inner-core');
    expect(layerAtRadius(earth, 1.2)).toBeNull();
  });
});

describe('rayHitShell', () => {
  const plane = { normal: [1, 0, 0] as Vec3, offset: 0 };
  it('hits the cut face of a half-sectioned shell, not the removed front', () => {
    // From +x looking down -x at y = 0.7: the front (x > 0) is cut away; the face is at x = 0 where r = 0.7.
    const t = rayHitShell([5, 0.7, 0], [-1, 0, 0], { outer: 0.988, inner: 0.547 }, plane);
    expect(t).toBeCloseTo(5);
  });
  it('passes through the hollow and the cut face outside the shell thickness', () => {
    // At y = 0.3 the face point is inside the hollow (r < inner): the ray goes on and meets the back of the inner wall.
    const t = rayHitShell([5, 0.3, 0], [-1, 0, 0], { outer: 0.988, inner: 0.547 }, plane);
    expect(t).toBeCloseTo(5 + Math.sqrt(0.547 ** 2 - 0.09));
  });
  it('hits the outer sphere when there is no cut, and misses beyond it', () => {
    expect(rayHitShell([5, 0, 0], [-1, 0, 0], { outer: 1, inner: 0.5 }, null)).toBeCloseTo(4);
    expect(rayHitShell([5, 1.1, 0], [-1, 0, 0], { outer: 1, inner: 0.5 }, null)).toBeNull();
  });
  it('treats a layer with no hollow (inner 0) as solid', () => {
    expect(rayHitShell([5, 0.1, 0], [-1, 0, 0], { outer: 0.2, inner: 0 }, plane)).toBeCloseTo(5);
  });
});

describe('exploreShellUniforms', () => {
  const frame: ExploreFrame = {
    bodyId: 'earth', view: 'exploded', progress: 1, focus: 0.5, drawn: earth, offsets: [0.8, 0.53, 0.27, 0],
    upWorld: [0, 0, 1], upObj: [0, 0, 1], planeNormalWorld: [0, 0, -1], planeNormalObj: [0, 0, -1], planeOffset: 0,
    cutsInnermost: false, shiftRadii: 0.8, halfHeightRadii: 1.2, selectedLayerId: null,
  };
  it('leaves bodies alone outside Explore', () => {
    expect(exploreShellUniforms(null, 'earth')).toEqual({ clip: null, dim: 1, liftRadii: 0 });
  });
  it('cuts and lifts the explored body, and dims the others with the focus', () => {
    expect(exploreShellUniforms(frame, 'earth')).toEqual({ clip: [0, 0, -1, 0], dim: 1, liftRadii: 0.8 });
    expect(exploreShellUniforms(frame, 'moon').dim).toBeCloseTo(1 - 0.75 * 0.5);
    expect(exploreShellUniforms({ ...frame, focus: 1 }, 'moon').dim).toBeCloseTo(EXPLORE_DIM);
  });
  it('does not cut while the plane is outside the body', () => {
    expect(exploreShellUniforms({ ...frame, planeOffset: 1 }, 'earth').clip).toBeNull();
  });
});
