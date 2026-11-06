import { add, cross, dot, length, normalize, scale, sub, type Vec3 } from '../../core/math/vec3';
import type { ExploreFrame } from './exploreFrame';

export interface LayerAnchorPoint {
  id: string;
  /** From the body's centre, world axes, in body radii. */
  offset: Vec3;
  /** The side of the body its label prefers: alternating from the right, outermost first. */
  side: 'left' | 'right';
}

/** In Half-section, how far above (+) or below (-) the horizontal the anchors sit on the face, per pair of layers. */
const SECTION_TILT_RAD = (25 * Math.PI) / 180;

/** A unit vector across `axis`, as close to `want` as possible (falls back to any perpendicular when `want` is along `axis`). */
function across(axis: Vec3, want: Vec3, fallback: Vec3): Vec3 {
  let v = sub(want, scale(axis, dot(want, axis)));
  if (length(v) < 1e-6) v = sub(fallback, scale(axis, dot(fallback, axis)));
  if (length(v) < 1e-6) v = cross(axis, Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  return normalize(v);
}

/**
 * Where each layer's floating label is anchored (spec §3.3), from `frame.explore`. `rightWorld` is the camera's screen-right.
 * - Exploded: on the visible band of each lifted cap (between its base ring and the base of the cap above), on its side;
 *   the innermost layer, a whole sphere, at its equator.
 * - Half-section: on the cut face, in the middle of the layer's ring, on its side, pairs of layers tilted up then down.
 * - Whole: none.
 */
export function layerAnchors(ex: ExploreFrame, rightWorld: Vec3): LayerAnchorPoint[] {
  if (ex.view === 'whole') return [];
  const up = normalize(ex.upWorld);
  const last = ex.drawn.length - 1;
  if (ex.view === 'exploded') {
    const right = across(up, rightWorld, ex.planeNormalWorld);
    return ex.drawn.map((layer, i) => {
      const side = i % 2 === 0 ? 'right' : 'left';
      const s = side === 'right' ? 1 : -1;
      const off = ex.offsets[i] ?? 0;
      const top = i === 0 ? layer.outer : Math.min(layer.outer, Math.max(0, (ex.offsets[i - 1] ?? 0) - off));
      const bottom = i === last ? -layer.outer : 0;
      const theta = (Math.asin(top / layer.outer) + Math.asin(bottom / layer.outer)) / 2;
      const offset = add(scale(up, off + layer.outer * Math.sin(theta)), scale(right, s * layer.outer * Math.cos(theta)));
      return { id: layer.id, offset, side };
    });
  }
  const n = normalize(ex.planeNormalWorld);
  const faceUp = across(n, up, rightWorld);
  let h = normalize(cross(faceUp, n));
  if (dot(h, rightWorld) < 0) h = scale(h, -1);
  const po = Math.max(0, ex.planeOffset);
  return ex.drawn.map((layer, i) => {
    const side = i % 2 === 0 ? 'right' : 'left';
    const s = side === 'right' ? 1 : -1;
    const mid = i === last ? layer.outer / 2 : (layer.outer + layer.inner) / 2;
    const inPlane = Math.sqrt(Math.max(mid * mid - po * po, 0));
    const tilt = i < 2 ? SECTION_TILT_RAD : -SECTION_TILT_RAD;
    const dir = add(scale(h, s * Math.cos(tilt)), scale(faceUp, Math.sin(tilt)));
    return { id: layer.id, offset: add(scale(n, po), scale(dir, inPlane)), side };
  });
}
