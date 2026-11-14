import type { Mat3 } from '../core/math/mat3';
import type { Vec3 } from '../core/math/vec3';

export type { ViewId } from '../state/viewStore';

export interface CameraPose {
  positionKm: Vec3;
  lookAtKm: Vec3;
  /** Screen-up direction: ecliptic north, or the body's pole when co-rotating. */
  up: Vec3;
}

export const ECLIPTIC_NORTH: Vec3 = [0, 0, 1];

/** Accumulated pointer input since the last frame, in CSS pixels; zoom > 0 moves away. */
export interface InputDeltas {
  rotateX: number;
  rotateY: number;
  panX: number;
  panY: number;
  zoom: number;
}

export const NO_INPUT: InputDeltas = { rotateX: 0, rotateY: 0, panX: 0, panY: 0, zoom: 0 };

export interface ControllerContext {
  bodyPosition(id: string): Vec3 | undefined;
  bodyRadiusKm(id: string): number;
  bodyOrientation(id: string): Mat3 | undefined;
}
