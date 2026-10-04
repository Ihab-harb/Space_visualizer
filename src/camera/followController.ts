import { apply, transpose, type Mat3 } from '../core/math/mat3';
import { add, normalize, scale, sub, ZERO, type Vec3 } from '../core/math/vec3';
import { applyOrbitInput, MIN_SURFACE_FACTOR, offsetDirection, sphericalFromOffset } from './orbitController';
import { keepOutside } from './rig';
import type { CameraPose, ControllerContext, InputDeltas } from './types';

export const FOLLOW_DISTANCE_RADII = 4;

export interface FollowState {
  targetId: string;
  distanceKm: number;
  azimuthRad: number;
  elevationRad: number;
  /** When true, azimuth/elevation are measured in the body-fixed frame, so the view turns with the body. */
  coRotate: boolean;
}

function worldDirection(state: FollowState, orientation: Mat3 | undefined): Vec3 {
  const local = offsetDirection(state.azimuthRad, state.elevationRad);
  return state.coRotate && orientation ? apply(orientation, local) : local;
}

export function followPose(state: FollowState, targetPositionKm: Vec3, orientation?: Mat3): CameraPose {
  return { positionKm: add(targetPositionKm, scale(worldDirection(state, orientation), state.distanceKm)), lookAtKm: targetPositionKm };
}

export function createFollowController(initial: FollowState) {
  let state = initial;
  const setDirection = (worldDir: Vec3, orientation: Mat3 | undefined) => {
    const local = state.coRotate && orientation ? apply(transpose(orientation), worldDir) : worldDir;
    const { azimuthRad, elevationRad } = sphericalFromOffset(local);
    state = { ...state, azimuthRad, elevationRad };
  };
  return {
    id: 'follow' as const,
    getState: () => state,
    setTarget(bodyId: string, ctx: ControllerContext) {
      state = { ...state, targetId: bodyId, distanceKm: ctx.bodyRadiusKm(bodyId) * FOLLOW_DISTANCE_RADII };
    },
    enter(from: CameraPose | null, ctx: ControllerContext, targetId: string) {
      this.setTarget(targetId, ctx);
      const center = ctx.bodyPosition(targetId) ?? ZERO;
      if (from) setDirection(normalize(sub(from.positionKm, center)), ctx.bodyOrientation(targetId));
    },
    setCoRotate(on: boolean, ctx: ControllerContext) {
      if (on === state.coRotate) return;
      const orientation = ctx.bodyOrientation(state.targetId);
      const current = worldDirection(state, orientation);
      state = { ...state, coRotate: on };
      setDirection(current, orientation);
    },
    update(input: InputDeltas, ctx: ControllerContext): CameraPose {
      const radius = ctx.bodyRadiusKm(state.targetId);
      const next = applyOrbitInput(
        { targetId: state.targetId, distanceKm: state.distanceKm, azimuthRad: state.azimuthRad, elevationRad: state.elevationRad, panOffsetKm: ZERO },
        { ...input, panX: 0, panY: 0 },
        radius,
      );
      state = { ...state, distanceKm: next.distanceKm, azimuthRad: next.azimuthRad, elevationRad: next.elevationRad };
      const center = ctx.bodyPosition(state.targetId) ?? ZERO;
      return keepOutside(followPose(state, center, ctx.bodyOrientation(state.targetId)), center, radius * MIN_SURFACE_FACTOR);
    },
  };
}
