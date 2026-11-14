import type { Body, ChebyshevFile } from '../core/catalog/schema';
import { systemState } from '../core/ephemeris/system';
import { bodyFixedToEcliptic } from '../core/frames/rotation';
import { DEG } from '../core/math/angles';
import type { Mat3 } from '../core/math/mat3';
import type { Vec3 } from '../core/math/vec3';
import { J2000_JD } from '../core/units';
import type { ExploreFrame } from './interior/exploreFrame';

/** Mutable per-frame cache shared by scene components (never stored in React state). */
export interface FrameState {
  jdTdb: number;
  cameraPositionKm: Vec3;
  bodyPositionsKm: Map<string, Vec3>;
  bodyInValidRange: Map<string, boolean>;
  bodyOrientation: Map<string, Mat3>;
  bodyRenderRadiusKm: Map<string, number>;
  /** Satellites not drawn this frame (inside their parent's disc in readable scale); their label and orbit line follow. */
  bodyHidden: Set<string>;
  viewportHeightPx: number;
  fovRad: number;
  /** Post-processing inputs written by the Sun effects (Task 6). */
  fx: { exposure: number; skyDim: number };
  /** The Explore interior on show this frame (shape documented in interior/exploreFrame.ts); null outside Explore. */
  explore: ExploreFrame | null;
  /**
   * Written by CameraSystem while Explore is framed: the explode axis captured at entry and the direction from the body to
   * where the camera is going (the orbit state, not the in-flight pose), so a Half-section faces the settled view.
   */
  exploreCamera: { upWorld: Vec3; toCameraWorld: Vec3 } | null;
}

export function createFrameState(): FrameState {
  return {
    jdTdb: J2000_JD,
    cameraPositionKm: [0, 0, 1e9],
    bodyPositionsKm: new Map(),
    bodyInValidRange: new Map(),
    bodyOrientation: new Map(),
    bodyRenderRadiusKm: new Map(),
    bodyHidden: new Set(),
    viewportHeightPx: 800,
    fovRad: 50 * DEG,
    fx: { exposure: 1, skyDim: 1 },
    explore: null,
    exploreCamera: null,
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
