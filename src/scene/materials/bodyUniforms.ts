import { apply, transpose, type Mat3 } from '../../core/math/mat3';
import { angleBetween, length, normalize, scale, sub, type Vec3 } from '../../core/math/vec3';
import { EARTHSHINE } from './illustrative';

export interface BodyFrameInput {
  bodyPosKm: Vec3;
  cameraPosKm: Vec3;
  sunPosKm: Vec3;
  orientation?: Mat3;
  renderRadiusKm: number;
  trueRadiusKm: number;
  sunRadiusKm: number;
  /** `atmosphere` marks occluders whose shadow gets the illustrative eclipse tint. */
  occluders: Array<{ posKm: Vec3; radiusKm: number; atmosphere?: boolean }>;
  /** Earth's position, for a body that gets earthshine (the Moon). */
  earthPosKm?: Vec3;
}

export interface BodyFrameUniforms {
  sunDirObj: Vec3;
  camObj: Vec3;
  sunDistTrue: number;
  sunRadiusTrue: number;
  occluders: Array<{ posTrue: Vec3; radiusTrue: number; atmosphere: boolean }>;
  /** Direction to Earth (object space) and strength: EARTHSHINE.max × (1 + cos φ) / 2, φ the angle at Earth between the Sun and the body. */
  earthshine: { dirObj: Vec3; strength: number } | null;
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
    occluders: i.occluders.map((o) => ({
      posTrue: scale(toBody(sub(o.posKm, i.bodyPosKm)), 1 / i.trueRadiusKm),
      radiusTrue: o.radiusKm / i.trueRadiusKm,
      atmosphere: o.atmosphere === true,
    })),
    earthshine: i.earthPosKm ? earthshine(i.earthPosKm, i.bodyPosKm, i.sunPosKm, toBody) : null,
  };
}

function earthshine(earth: Vec3, body: Vec3, sun: Vec3, toBody: (v: Vec3) => Vec3): { dirObj: Vec3; strength: number } | null {
  const toEarth = sub(earth, body);
  if (length(toEarth) === 0) return null;
  // Earth's lit fraction seen from the body: the phase angle at Earth between the Sun and the body.
  const phi = angleBetween(sub(sun, earth), sub(body, earth));
  return { dirObj: toBody(normalize(toEarth)), strength: (EARTHSHINE.max * (1 + Math.cos(phi))) / 2 };
}

/** Equirectangular texture coordinate convention shared with the rotated SphereGeometry. */
export function uvForLonLat(lonDeg: number, latDeg: number): [number, number] {
  return [((lonDeg / 360 + 0.5) % 1 + 1) % 1, 0.5 + latDeg / 180];
}
