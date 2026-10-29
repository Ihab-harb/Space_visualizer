import { SphereGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { rotZ, transpose } from '../../core/math/mat3';
import { computeBodyFrameUniforms, uvForLonLat } from './bodyUniforms';
import { EARTHSHINE } from './illustrative';

const base = { bodyPosKm: [10, 0, 0] as const, cameraPosKm: [10, 0, 5] as const, sunPosKm: [0, 0, 0] as const, renderRadiusKm: 1, trueRadiusKm: 1, sunRadiusKm: 0.1, occluders: [] };

describe('computeBodyFrameUniforms', () => {
  it('expresses the sun direction and camera in object space', () => {
    const u = computeBodyFrameUniforms(base);
    u.sunDirObj.forEach((v, i) => expect(v).toBeCloseTo([-1, 0, 0][i]!, 12));
    u.camObj.forEach((v, i) => expect(v).toBeCloseTo([0, 0, 5][i]!, 12));
    expect(u.sunDistTrue).toBeCloseTo(10, 12);
  });
  it('rotates into the body-fixed frame', () => {
    const orientation = transpose(rotZ(Math.PI / 2)); // body x axis = ecliptic +y
    const u = computeBodyFrameUniforms({ ...base, orientation });
    u.sunDirObj.forEach((v, i) => expect(v).toBeCloseTo([0, 1, 0][i]!, 12));
  });
  it('uses render units for the camera and true units for shadows', () => {
    const u = computeBodyFrameUniforms({ ...base, renderRadiusKm: 2, trueRadiusKm: 0.5, occluders: [{ posKm: [11, 0, 0], radiusKm: 0.25 }] });
    expect(u.camObj[2]).toBeCloseTo(2.5, 12);
    expect(u.occluders[0]!.posTrue[0]).toBeCloseTo(2, 12);
    expect(u.occluders[0]!.radiusTrue).toBeCloseTo(0.5, 12);
  });
});

describe('texture convention', () => {
  it('matches the rotated SphereGeometry uv layout (lon 0 at +X, east = +Y, north = +Z)', () => {
    const g = new SphereGeometry(1, 64, 32);
    g.rotateX(Math.PI / 2);
    const pos = g.attributes.position!;
    const uv = g.attributes.uv!;
    const find = (target: Vector3) => {
      let best = 0;
      for (let i = 1; i < pos.count; i++) if (new Vector3().fromBufferAttribute(pos, i).distanceTo(target) < new Vector3().fromBufferAttribute(pos, best).distanceTo(target)) best = i;
      return [uv.getX(best), uv.getY(best)];
    };
    const [u0, v0] = find(new Vector3(1, 0, 0));
    expect(u0).toBeCloseTo(uvForLonLat(0, 0)[0], 2);
    expect(v0).toBeCloseTo(uvForLonLat(0, 0)[1], 2);
    expect(find(new Vector3(0, 1, 0))[0]).toBeCloseTo(uvForLonLat(90, 0)[0], 2);
    expect(find(new Vector3(0, 0, 0.999))[1]).toBeCloseTo(1, 2);
  });
});

describe('earthshine (Moon night side)', () => {
  // Sun at the origin, Earth 1 AU out on +x; the Moon 384,400 km from Earth.
  const earth = [1.496e8, 0, 0] as const;
  const moon = (pos: readonly [number, number, number], orientation?: ReturnType<typeof rotZ>) =>
    computeBodyFrameUniforms({ ...base, bodyPosKm: pos, cameraPosKm: [pos[0], pos[1], pos[2] + 1e4], earthPosKm: earth, ...(orientation ? { orientation } : {}) });

  it('is strongest at new Moon, when Earth turns its whole day side to the Moon', () => {
    expect(moon([earth[0] - 384400, 0, 0]).earthshine!.strength).toBeCloseTo(EARTHSHINE.max, 9);
  });
  it('is zero at full Moon, when Earth turns its night side to the Moon', () => {
    expect(moon([earth[0] + 384400, 0, 0]).earthshine!.strength).toBeCloseTo(0, 9);
  });
  it('is half the maximum at quarter Moon', () => {
    expect(moon([earth[0], 384400, 0]).earthshine!.strength).toBeCloseTo(EARTHSHINE.max / 2, 9);
  });
  it('points from the Moon to Earth in object space', () => {
    const u = moon([earth[0], 384400, 0], transpose(rotZ(Math.PI / 2))); // body x axis = ecliptic +y
    u.earthshine!.dirObj.forEach((v, i) => expect(v).toBeCloseTo([-1, 0, 0][i]!, 9));
  });
  it('is absent for bodies Earth does not light', () => {
    expect(computeBodyFrameUniforms(base).earthshine).toBeNull();
  });
});

describe('occluder atmosphere flag', () => {
  it('passes each occluder’s atmosphere flag through to the shader uniforms', () => {
    const u = computeBodyFrameUniforms({ ...base, occluders: [{ posKm: [11, 0, 0], radiusKm: 0.25, atmosphere: true }, { posKm: [12, 0, 0], radiusKm: 0.25, atmosphere: false }] });
    expect(u.occluders.map((o) => o.atmosphere)).toEqual([true, false]);
  });
});
