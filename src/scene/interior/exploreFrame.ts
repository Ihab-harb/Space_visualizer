import type { DrawnLayer } from '../../core/interior/geometry';
import { add, cross, dot, length, normalize, scale, sub, type Vec3 } from '../../core/math/vec3';
import type { ExploreView } from '../../state/exploreStore';

/**
 * Per-frame Explore geometry, published in FrameState as `frame.explore` (controller ruling R2) so the floating labels
 * (Task 7) and every scene part read one source of truth. Lengths are in body radii (the explored body's render
 * equatorial radius, `frame.bodyRenderRadiusKm`). "World" vectors are ecliptic (the scene's axes); "Obj" vectors are in
 * the body-fixed frame of the orientation frozen at entry (`frame.bodyOrientation` holds it while the session lasts).
 *
 * A layer i is drawn as a shell centred at `upWorld * offsets[i]` from the body centre. Points p (relative to that
 * centre, body-fixed, body radii) with dot(p, planeNormalObj) > planeOffset are removed; the cut face lies on that plane.
 * In Half-section every layer is cut by the plane through the centre turned toward the camera. In Exploded the plane is
 * horizontal (normal -up): each layer above the innermost is the upper cap of its shell, lifted along up; the innermost
 * layer stays whole (`cutsInnermost` false).
 */
export interface ExploreFrame {
  bodyId: string;
  /** The view whose geometry is drawn (lags the store's view while one view closes before the next opens). */
  view: ExploreView;
  /** Eased progress of `view`, 0 (closed) to 1 (open). */
  progress: number;
  /** Eased 0 to 1: how far the other bodies are dimmed and the Sun's effects are turned down. */
  focus: number;
  /** Layers outside in, from `drawnLayers`. */
  drawn: DrawnLayer[];
  /** Per layer, the lift along `upWorld` in body radii (`explodeOffsets`). */
  offsets: number[];
  /** Explode axis: screen-up of the view at entry (unit). */
  upWorld: Vec3;
  upObj: Vec3;
  /** Cut plane normal, pointing to the removed side (unit). */
  planeNormalWorld: Vec3;
  planeNormalObj: Vec3;
  /** Plane distance from each shell's centre along the normal, body radii; 1 or more means nothing is cut. */
  planeOffset: number;
  cutsInnermost: boolean;
  /** Centre of the drawn extent along `upWorld` (body radii): the camera looks here. */
  shiftRadii: number;
  selectedLayerId: string | null;
}

/** The Half-section face is turned this far (45 degrees, about the explode axis, toward screen-right) from facing the camera squarely, so
 * a crescent of the real surface stays in view beside the face (mockup C). Illustrative, tuned on the screenshots. */
export const SECTION_YAW_RAD = (45 * Math.PI) / 180;

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** A unit normal across the explode axis `up`, facing `toCamera`, turned by `yawRad` about `up` (toward screen-right). */
export function sectionNormal(toCamera: Vec3, up: Vec3, yawRad: number): Vec3 {
  const u = normalize(up);
  let p = sub(toCamera, scale(u, dot(toCamera, u)));
  if (length(p) < 1e-6) {
    p = cross(u, [1, 0, 0]);
    if (length(p) < 1e-6) p = cross(u, [0, 1, 0]);
  }
  p = normalize(p);
  const right = cross(u, p);
  return normalize(add(scale(p, Math.cos(yawRad)), scale(right, Math.sin(yawRad))));
}

/**
 * How far the cut has swept (0 none, 1 through the centre) and how far the shells are lifted, at an eased progress.
 * Half-section slices in from the front. Exploded slices the lower halves off first, then lifts the caps.
 */
export function cutAmounts(view: ExploreView, progress: number): { cut: number; explode: number } {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  if (view === 'section') return { cut: p, explode: 0 };
  if (view === 'exploded') return { cut: smoothstep(0, 0.4, p), explode: smoothstep(0.25, 1, p) };
  return { cut: 0, explode: 0 };
}

/** Vertical extent (along up, body radii) of the Exploded model at a cut amount: lifted caps above, innermost layer below. */
export function drawnExtent(drawn: readonly DrawnLayer[], offsets: readonly number[], cut: number): { bottom: number; top: number } {
  if (drawn.length === 0) return { bottom: -1, top: 1 };
  const floor = -(1 - Math.min(1, Math.max(0, cut)));
  let bottom = Infinity;
  let top = -Infinity;
  drawn.forEach((layer, i) => {
    const off = offsets[i] ?? 0;
    const innermost = i === drawn.length - 1;
    bottom = Math.min(bottom, off + (innermost ? -layer.outer : Math.max(floor, -layer.outer)));
    top = Math.max(top, off + layer.outer);
  });
  return { bottom, top };
}

/** The layer whose shell holds radius r (body radii), outside in; null outside the body. */
export function layerAtRadius(drawn: readonly DrawnLayer[], r: number): string | null {
  if (!(r >= 0)) return null;
  for (const layer of drawn) if (r <= layer.outer && r >= layer.inner) return layer.id;
  return null;
}

function sphereRoots(o: Vec3, d: Vec3, radius: number): [number, number] | null {
  const a = dot(d, d);
  const b = dot(o, d);
  const c = dot(o, o) - radius * radius;
  const disc = b * b - a * c;
  if (disc < 0 || radius <= 0) return null;
  const s = Math.sqrt(disc);
  return [(-b - s) / a, (-b + s) / a];
}

/**
 * Distance along a ray (origin and direction relative to the shell's centre, body radii) to the first visible part of a
 * shell cut by a plane: its outer surface, its cut face (between inner and outer), or the inside of its hollow. Null on a
 * miss. Spheres only (flattening is ignored for picking).
 */
export function rayHitShell(o: Vec3, d: Vec3, shell: { outer: number; inner: number }, plane: { normal: Vec3; offset: number } | null): number | null {
  const kept = (t: number) => !plane || dot(plane.normal, add(o, scale(d, t))) <= plane.offset + 1e-9;
  let best = Infinity;
  const consider = (t: number | null | undefined) => {
    if (t !== null && t !== undefined && t > 0 && t < best) best = t;
  };
  const outer = sphereRoots(o, d, shell.outer);
  if (outer && kept(outer[0])) consider(outer[0]);
  if (plane) {
    const dn = dot(plane.normal, d);
    if (Math.abs(dn) > 1e-12) {
      const t = (plane.offset - dot(plane.normal, o)) / dn;
      const r = length(add(o, scale(d, t)));
      if (r <= shell.outer && r >= shell.inner) consider(t);
    }
  }
  if (shell.inner > 0) {
    const inner = sphereRoots(o, d, shell.inner);
    if (inner && kept(inner[1])) consider(inner[1]);
  }
  return Number.isFinite(best) ? best : null;
}

/** Other bodies' brightness while Explore is in focus (spec §3.2: a material-level fade to about 25 %). */
export const EXPLORE_DIM = 0.25;

/**
 * What a body's own materials need from Explore: the cut for the explored body's outer shell (normal xyz and offset, body
 * frame; null when nothing is cut), the dimming for every other body, and how far the outer shell is lifted (body radii).
 */
export function exploreShellUniforms(explore: ExploreFrame | null, bodyId: string): { clip: [number, number, number, number] | null; dim: number; liftRadii: number } {
  if (!explore) return { clip: null, dim: 1, liftRadii: 0 };
  if (explore.bodyId !== bodyId) return { clip: null, dim: 1 - (1 - EXPLORE_DIM) * explore.focus, liftRadii: 0 };
  const n = explore.planeNormalObj;
  return { clip: explore.planeOffset < 1 ? [n[0], n[1], n[2], explore.planeOffset] : null, dim: 1, liftRadii: explore.offsets[0] ?? 0 };
}
