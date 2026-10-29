import type { Body, ChebyshevFile } from '../core/catalog/schema';
import { systemState } from '../core/ephemeris/system';
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
  bodyRenderRadiusKm: Map<string, number>;
  viewportHeightPx: number;
  fovRad: number;
  /** Post-processing inputs written by the Sun effects (Task 6). */
  fx: { exposure: number; skyDim: number };
}

export function createFrameState(): FrameState {
  return {
    jdTdb: J2000_JD,
    cameraPositionKm: [0, 0, 1e9],
    bodyPositionsKm: new Map(),
    bodyInValidRange: new Map(),
    bodyOrientation: new Map(),
    bodyRenderRadiusKm: new Map(),
    viewportHeightPx: 800,
    fovRad: 50 * DEG,
    fx: { exposure: 1, skyDim: 1 },
  };
}

export function updateBodies(
  frame: FrameState,
  bodies: readonly Body[],
  tables: ReadonlyMap<string, ChebyshevFile>,
  jdTdb: number,
): void {
  frame.jdTdb = jdTdb;
  const states = systemState(bodies, tables, jdTdb);
  for (const body of bodies) {
    const state = states.get(body.id)!;
    frame.bodyPositionsKm.set(body.id, state.positionKm);
    frame.bodyInValidRange.set(body.id, state.inValidRange);
    if (body.rotation) frame.bodyOrientation.set(body.id, bodyFixedToEcliptic(body.rotation, jdTdb));
  }
}
