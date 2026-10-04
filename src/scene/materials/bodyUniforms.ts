import { apply, transpose, type Mat3 } from '../../core/math/mat3';
import { length, normalize, scale, sub, type Vec3 } from '../../core/math/vec3';

export interface BodyFrameInput {
  bodyPosKm: Vec3;
  cameraPosKm: Vec3;
  sunPosKm: Vec3;
  orientation?: Mat3;
  renderRadiusKm: number;
  trueRadiusKm: number;
  sunRadiusKm: number;
  occluders: Array<{ posKm: Vec3; radiusKm: number }>;
}

export interface BodyFrameUniforms {
  sunDirObj: Vec3;
  camObj: Vec3;
  sunDistTrue: number;
  sunRadiusTrue: number;
  occluders: Array<{ posTrue: Vec3; radiusTrue: number }>;
}

/** Float64 world (ecliptic, km) → body-fixed object space for shaders. */
export function computeBodyFrameUniforms(i: BodyFrameInput): BodyFrameUniforms {
  const toBody = (v: Vec3) => (i.orientation ? apply(transpose(i.orientation), v) : v);
  const toSun = sub(i.sunPosKm, i.bodyPosKm);
  const sunDist = length(toSun);
  return {
    sunDirObj: sunDist > 0 ? toBody(normalize(toSun)) : [0, 0, 1],
    camObj: scale(toBody(sub(i.cameraPosKm, i.bodyPosKm)), 1 / i.renderRadiusKm),
    sunDistTrue: sunDist / i.trueRadiusKm,
    sunRadiusTrue: i.sunRadiusKm / i.trueRadiusKm,
    occluders: i.occluders.map((o) => ({ posTrue: scale(toBody(sub(o.posKm, i.bodyPosKm)), 1 / i.trueRadiusKm), radiusTrue: o.radiusKm / i.trueRadiusKm })),
  };
}

/** Equirectangular texture coordinate convention shared with the rotated SphereGeometry. */
export function uvForLonLat(lonDeg: number, latDeg: number): [number, number] {
  return [((lonDeg / 360 + 0.5) % 1 + 1) % 1, 0.5 + latDeg / 180];
}
