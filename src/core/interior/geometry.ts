import { resolveLayerRanges } from '../details/checks';
import type { InteriorLayer } from '../details/schema';

export interface DrawnLayer {
  id: string;
  name: string;
  /** Radii as fractions of the body's drawn radius (1 = surface), outer > inner. */
  outer: number;
  inner: number;
  /** Soft band widths (fraction of radius) where a bound is a range; 0 for a sharp boundary. */
  outerBand: number;
  innerBand: number;
  /** Drawn thicker than scale (spec section 6, under 1.2 % of the radius). */
  thickened: boolean;
  sizeKind: 'cited' | 'estimate' | 'illustrative';
  state: InteriorLayer['state'];
}

/** Smallest gap kept between two radii so a layer never collapses to nothing. */
const TINY = 1e-6;
/** Spacing between layers when exploded, in body radii, and the most the outermost shell may lift in total. */
const EXPLODE_STEP = 0.3;
const EXPLODE_MAX = 0.8;

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/**
 * The shells to draw, outside in. A range bound draws at its midpoint with a soft band; a layer thinner than `minThickness`
 * (default 1.2 % of the radius) is thickened by moving its inner bound inward, never past the layers below it.
 */
export function drawnLayers(layers: readonly InteriorLayer[], bodyRadiusKm: number, opts: { minThickness?: number } = {}): DrawnLayer[] {
  if (!(bodyRadiusKm > 0) || layers.length === 0) return [];
  const minThickness = opts.minThickness ?? 0.012;
  const ranges = resolveLayerRanges(layers, bodyRadiusKm);
  const n = layers.length;
  const out: DrawnLayer[] = [];
  let ceiling = 1;
  layers.forEach((layer, i) => {
    const range = ranges[i]!;
    const floor = (n - 1 - i) * TINY;
    const outer = Math.max(floor + TINY, Math.min(clamp01((range.outer.min + range.outer.max) / 2 / bodyRadiusKm), ceiling));
    let inner = Math.max(floor, Math.min(clamp01((range.inner.min + range.inner.max) / 2 / bodyRadiusKm), outer - TINY));
    let thickened = false;
    if (outer - inner < minThickness) {
      inner = Math.max(floor, outer - minThickness);
      thickened = true;
    }
    const sizeKind = range.shared || layer.sizeKind === 'illustrative' ? 'illustrative' : layer.sizeKind === 'estimate' ? 'estimate' : 'cited';
    const band = (r: { min: number; max: number }) => (range.shared ? 0 : Math.min(outer - inner, Math.max(0, (r.max - r.min) / bodyRadiusKm)));
    out.push({ id: layer.id, name: layer.name, outer, inner, outerBand: band(range.outer), innerBand: band(range.inner), thickened, sizeKind, state: layer.state });
    ceiling = inner;
  });
  return out;
}

/** How far each layer lifts along screen-up, in body radii. Zero at progress 0; the outermost lifts most, the innermost stays. */
export function explodeOffsets(layers: readonly DrawnLayer[], progress: number): number[] {
  const p = clamp01(progress);
  const step = layers.length > 1 ? Math.min(EXPLODE_STEP, EXPLODE_MAX / (layers.length - 1)) : 0;
  return layers.map((_, i) => p * step * (layers.length - 1 - i));
}

/** What each view shows at an animation progress (0 to 1): whether the wedge is cut away and how far the shells are exploded. */
export function sectionVisible(view: 'whole' | 'exploded' | 'section', progress: number): { cut: boolean; explode: number } {
  const p = clamp01(progress);
  if (view === 'exploded') return { cut: false, explode: p };
  if (view === 'section') return { cut: p > 0, explode: 0 };
  return { cut: false, explode: 0 };
}
