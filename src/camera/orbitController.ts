import { DEG } from '../core/math/angles';
import { add, length, scale, sub, ZERO, type Vec3 } from '../core/math/vec3';
import { keepOutside } from './rig';
import { ECLIPTIC_NORTH, type CameraPose, type ControllerContext, type InputDeltas } from './types';

export const ROTATE_RAD_PER_PX = 0.005;
export const ZOOM_PER_UNIT = 0.0015;
export const PAN_PER_PX = 0.0015;
export const MAX_ELEVATION_RAD = 89.9 * DEG;
/** The camera never comes closer to a body's centre than this many radii. */
export const MIN_SURFACE_FACTOR = 1.2;
export const MAX_DISTANCE_KM = 5e11;
const FOCUS_DISTANCE_RADII = 6;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface OrbitState {
  targetId: string;
  distanceKm: number;
  azimuthRad: number;
  elevationRad: number;
  panOffsetKm: Vec3;
}

export function offsetDirection(azimuthRad: number, elevationRad: number): Vec3 {
  const ce = Math.cos(elevationRad);
  return [ce * Math.cos(azimuthRad), ce * Math.sin(azimuthRad), Math.sin(elevationRad)];
}

export function sphericalFromOffset(offset: Vec3): { distanceKm: number; azimuthRad: number; elevationRad: number } {
  const d = length(offset);
  if (d === 0) return { distanceKm: 0, azimuthRad: 0, elevationRad: 0 };
  return {
    distanceKm: d,
    azimuthRad: Math.atan2(offset[1], offset[0]),
    elevationRad: clamp(Math.asin(clamp(offset[2] / d, -1, 1)), -MAX_ELEVATION_RAD, MAX_ELEVATION_RAD),
  };
}

export function applyOrbitInput(state: OrbitState, input: InputDeltas, targetRadiusKm: number): OrbitState {
  const azimuthRad = state.azimuthRad - input.rotateX * ROTATE_RAD_PER_PX;
  const elevationRad = clamp(state.elevationRad + input.rotateY * ROTATE_RAD_PER_PX, -MAX_ELEVATION_RAD, MAX_ELEVATION_RAD);
  const distanceKm = clamp(state.distanceKm * Math.exp(input.zoom * ZOOM_PER_UNIT), targetRadiusKm * MIN_SURFACE_FACTOR, MAX_DISTANCE_KM);
  const right: Vec3 = [-Math.sin(azimuthRad), Math.cos(azimuthRad), 0];
  const up: Vec3 = [-Math.sin(elevationRad) * Math.cos(azimuthRad), -Math.sin(elevationRad) * Math.sin(azimuthRad), Math.cos(elevationRad)];
  const panScale = distanceKm * PAN_PER_PX;
  const panOffsetKm = add(state.panOffsetKm, add(scale(right, -input.panX * panScale), scale(up, input.panY * panScale)));
  return { ...state, azimuthRad, elevationRad, distanceKm, panOffsetKm };
}

export function orbitPose(state: OrbitState, targetPositionKm: Vec3): CameraPose {
  const lookAtKm = add(targetPositionKm, state.panOffsetKm);
  return {
    positionKm: add(lookAtKm, scale(offsetDirection(state.azimuthRad, state.elevationRad), state.distanceKm)),
    lookAtKm,
    up: ECLIPTIC_NORTH,
  };
}

export function createOrbitController(initial: OrbitState) {
  let state = initial;
  const target = (ctx: ControllerContext) => ctx.bodyPosition(state.targetId) ?? ZERO;
  return {
    id: 'orbit' as const,
    getState: () => state,
    /** Take over from another view; pass targetId to pivot on the body that view was showing. */
    enter(from: CameraPose | null, ctx: ControllerContext, targetId?: string) {
      if (targetId) state = { ...state, targetId, panOffsetKm: ZERO };
      if (!from) return;
      const spherical = sphericalFromOffset(sub(from.positionKm, add(target(ctx), state.panOffsetKm)));
      if (spherical.distanceKm > 0) state = { ...state, ...spherical };
    },
    focus(bodyId: string, ctx: ControllerContext) {
      state = { ...state, targetId: bodyId, panOffsetKm: ZERO, distanceKm: ctx.bodyRadiusKm(bodyId) * FOCUS_DISTANCE_RADII };
    },
    setView(view: { distanceKm?: number; azimuthRad?: number; elevationRad?: number }) {
      state = {
        ...state,
        ...(view.distanceKm !== undefined ? { distanceKm: Math.min(MAX_DISTANCE_KM, Math.max(0, view.distanceKm)) } : {}),
        ...(view.azimuthRad !== undefined ? { azimuthRad: view.azimuthRad } : {}),
        ...(view.elevationRad !== undefined ? { elevationRad: clamp(view.elevationRad, -MAX_ELEVATION_RAD, MAX_ELEVATION_RAD) } : {}),
      };
    },
    update(input: InputDeltas, ctx: ControllerContext): CameraPose {
      const radius = ctx.bodyRadiusKm(state.targetId);
      state = applyOrbitInput(state, input, radius);
      const center = target(ctx);
      return keepOutside(orbitPose(state, center), center, radius * MIN_SURFACE_FACTOR);
    },
  };
}
