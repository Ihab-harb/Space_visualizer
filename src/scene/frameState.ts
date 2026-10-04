import type { Body } from '../core/catalog/schema';
import { bodyState } from '../core/ephemeris/state';
import { bodyFixedToEcliptic } from '../core/frames/rotation';
import { DEG } from '../core/math/angles';
import type { Mat3 } from '../core/math/mat3';
import type { Vec3 } from '../core/math/vec3';
import { J2000_JD } from '../core/units';

/** Mutable per-frame cache shared by scene components (never stored in React state). */
export interface FrameState {
  jdTdb: number;
  cameraPositionKm: Vec3;
  bodyPositionsKm: Map<string, Vec3>;
  bodyInValidRange: Map<string, boolean>;
  bodyOrientation: Map<string, Mat3>;
  viewportHeightPx: number;
  fovRad: number;
}

export function createFrameState(): FrameState {
  return {
    jdTdb: J2000_JD,
    cameraPositionKm: [0, 0, 1e9],
    bodyPositionsKm: new Map(),
    bodyInValidRange: new Map(),
    bodyOrientation: new Map(),
    viewportHeightPx: 800,
    fovRad: 50 * DEG,
  };
}

export function updateBodies(frame: FrameState, bodies: readonly Body[], jdTdb: number): void {
  frame.jdTdb = jdTdb;
  for (const body of bodies) {
    const state = bodyState(body, jdTdb);
    frame.bodyPositionsKm.set(body.id, state.positionKm);
    frame.bodyInValidRange.set(body.id, state.inValidRange);
    if (body.rotation) frame.bodyOrientation.set(body.id, bodyFixedToEcliptic(body.rotation, jdTdb));
  }
}
