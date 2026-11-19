/**
 * Where the feature pins sit on the globe and how much of each is shown (Explore, Surface). Pure: world vectors are
 * ecliptic, lengths in body radii (the explored body's render equatorial radius).
 */
import { surfaceDirection, surfacePoint } from '../../core/frames/surfacePoint';
import { apply, type Mat3 } from '../../core/math/mat3';
import { dot, normalize, scale, sub, type Vec3 } from '../../core/math/vec3';
import type { ExploreView } from '../../state/exploreStore';
import type { LabelAnchor, Side, Size } from '../../ui/explore/labelLayout';

/** Cosine of the angle between the surface normal and the line to the camera: hidden at `from` and below, fully shown at `to`. */
export const PIN_FADE = { from: 0.08, to: 0.25 };

/** A pin's names are laid out only when it is this far shown (well inside the limb). */
const NAMED_FACING = 0.5;

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 0 hidden .. 1 fully shown; smooth between PIN_FADE.from and PIN_FADE.to. All three vectors in one frame. */
export function pinFacing(pointWorld: Vec3, normalWorld: Vec3, cameraWorld: Vec3): number {
  const cos = dot(normalize(normalWorld), normalize(sub(cameraWorld, pointWorld)));
  return Number.isFinite(cos) ? smoothstep(PIN_FADE.from, PIN_FADE.to, cos) : 0;
}

export interface PinInput {
  id: string;
  latDeg: number;
  lonDegE: number;
  /** 0 = best known. */
  rank: number;
}

export interface PinPoint {
  id: string;
  rank: number;
  /** From the body centre, body radii. */
  offsetWorld: Vec3;
  facing: number;
}

/**
 * Each pin's point on the flattened globe (the same point the drawn mesh puts the feature's texel at) and how much it faces
 * the camera. The facing test uses the true ellipsoid normal: on a flattened body the direction of the point is not the
 * normal, and near the limb at mid latitudes the two differ by up to the flattening.
 * `orientation` turns body-fixed into world; the camera is at `toCameraWorld * distanceRadii` from the body centre.
 */
export function pinPoints(pins: readonly PinInput[], orientation: Mat3, flattening: number, toCameraWorld: Vec3, distanceRadii: number): PinPoint[] {
  const camera = scale(toCameraWorld, distanceRadii);
  return pins.map((p) => {
    const d = surfaceDirection(p.latDeg, p.lonDegE);
    const offsetWorld = apply(orientation, surfacePoint(p.latDeg, p.lonDegE, flattening));
    // The gradient of x² + y² + (z/f)² at (d0, d1, f·d2) is along (d0, d1, d2/f).
    const normalWorld = apply(orientation, [d[0], d[1], d[2] / flattening]);
    return { id: p.id, rank: p.rank, offsetWorld, facing: pinFacing(offsetWorld, normalWorld, camera) };
  });
}

/** A name goes on the side of the body its pin is on. */
export function pinSide(x: number, bodyX: number): Side {
  return x < bodyX ? 'left' : 'right';
}

/**
 * The name layout's options (labelLayout): a name moves at most this far up or down from its pin (a fraction of the viewport
 * height), so leaders stay close to level, as in the approved mockup. A pin whose name does not fit keeps its dot and names
 * itself on hover. Tuned on the screenshots: at the default 0.35, and still at 0.12, a cluster of pins (North America seen from
 * the Pacific) fanned out into long steep leaders. A name stays on its pin's side of the globe (`sameSideOnly`): moved across,
 * its leader would run over the globe.
 */
export const PIN_NAME_LAYOUT = { maxShiftFraction: 0.07, sameSideOnly: true };

/**
 * A dot's centre stays at least this far inside the viewport, px: half the largest dot (the phone's numbered one is 22 px),
 * so a shown dot is never cut by the edge and focusing it never scrolls the label layer.
 */
export const PIN_DOT_INSET = 11;

/** Whether a dot is shown (and so in the tab order): it faces the camera and sits wholly on screen. */
export function pinDotShown(p: { facing: number; x: number; y: number }, viewport: Size): boolean {
  return p.facing > 0 && p.x >= PIN_DOT_INSET && p.x <= viewport.width - PIN_DOT_INSET && p.y >= PIN_DOT_INSET && p.y <= viewport.height - PIN_DOT_INSET;
}

export interface PinLayerState {
  /** The store: what the user asked for. */
  store: { active: boolean; bodyId: string | null; view: ExploreView; chartOpen: boolean };
  /** The scene (`frame.explore`): what is drawn. */
  explore: { bodyId: string; view: ExploreView; progress: number } | null;
  /** The body's position, render radius and orientation are known this frame. */
  ready: boolean;
}

/**
 * Whether the pins show at all: Explore active on the drawn body, on Surface (the store's view is 'whole'), with the drawn
 * body closed and the chart shut. Never together with the interior labels, which need an open interior view.
 */
export function pinLayerShown({ store, explore, ready }: PinLayerState): boolean {
  if (!explore || !ready || !store.active || store.chartOpen || store.bodyId !== explore.bodyId || store.view !== 'whole') return false;
  return explore.view === 'whole' || explore.progress === 0;
}

/** Above any rank-based priority: the selected and the hovered (or focused) pin are named first. */
const FIRST = 1e6;

/**
 * The name layout's input (labelLayout): the pins well inside the facing side, each named on its side of the body, the
 * best known first, the selected and the hovered one before all. A name has no shorter form, so `collapsed` is `full`.
 */
export function pinNameAnchors(
  points: ReadonlyArray<{ id: string; rank: number; x: number; y: number; facing: number }>,
  sizes: ReadonlyMap<string, Size>,
  bodyX: number,
  focus: { selectedId: string | null; hoveredId: string | null },
): LabelAnchor[] {
  const count = points.length;
  return points
    .filter((p) => p.facing > NAMED_FACING && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => {
      const size = sizes.get(p.id) ?? { width: 0, height: 0 };
      return {
        id: p.id,
        x: p.x,
        y: p.y,
        side: pinSide(p.x, bodyX),
        priority: p.id === focus.selectedId || p.id === focus.hoveredId ? FIRST : count - p.rank,
        full: size,
        collapsed: size,
      };
    });
}
