import type { BodyDetails, InteriorLayer, SourcedRange } from '../../core/details/schema';
import type { DrawnLayer } from '../../core/interior/geometry';
import { formatNumber } from '../format';
import { boundWording } from '../interiorText';
import type { Rect, Size } from './labelLayout';

/**
 * The Half-section depth ruler (spec §2 and §6, mockup 1 option C): a scale beside the cut face from the surface (0 km) down
 * to the centre, with a tick at each layer boundary. Each value is the cited bound as a depth below the surface:
 * - a bound stated as a depth keeps its own numbers ("30 km", "10–50 km"; "≈ 20 km" where the source says "about");
 * - a bound stated as a radius becomes the cited radius minus it (Earth: 6,371 - 3,485 = 2,886 km);
 * - a bound stated as a percent of the radius becomes an approximate depth, rounded to three figures ("≈ 25,900 km");
 * - an illustrative boundary gets a tick and no number.
 * The centre shows the cited radius the build converted the bounds with (`interior.radiusKm`). Each value carries its source;
 * a bound from a paper is an estimate.
 */
export interface RulerTick {
  kind: 'surface' | 'boundary' | 'centre';
  /** Drawn radius fraction (1 surface, 0 centre): where the tick sits on the face. */
  r: number;
  /** The depth text, or null for a tick with no number. */
  value: string | null;
  sourceId?: string;
  estimate: boolean;
}

const threeFigures = (x: number): number => {
  if (x === 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(x))) - 2);
  return Math.round(x / p) * p;
};

const span = (lo: number, hi: number, approx: boolean): string => {
  const text = lo === hi ? formatNumber(lo) : `${formatNumber(lo)}–${formatNumber(hi)}`;
  return `${approx ? '≈ ' : ''}${text} km`;
};

/** A bound as a depth below the surface, or null when that needs a radius the data does not give. */
function depthText(r: SourcedRange, radiusKm: number | undefined, about: boolean): string | null {
  const form = r.from ?? 'radius';
  if (form === 'depth') {
    const s = r.stated ?? { min: radiusKm !== undefined ? radiusKm - r.max : NaN, max: radiusKm !== undefined ? radiusKm - r.min : NaN };
    return Number.isFinite(s.min) ? span(s.min, s.max, about) : null;
  }
  if (radiusKm === undefined) return null;
  if (form === 'percent') {
    const s = r.stated ?? { min: (r.min / radiusKm) * 100, max: (r.max / radiusKm) * 100 };
    const deep = (p: number) => threeFigures((radiusKm * (100 - p)) / 100);
    return span(deep(s.max), deep(s.min), true);
  }
  return span(Math.round(radiusKm - r.max), Math.round(radiusKm - r.min), about);
}

const sized = (l: InteriorLayer | undefined): l is InteriorLayer & { outerRadiusKm: SourcedRange; innerRadiusKm: SourcedRange } =>
  !!l && l.sizeKind !== 'illustrative' && !!l.outerRadiusKm && !!l.innerRadiusKm;

export function depthRulerTicks(bodyId: string, details: BodyDetails, drawn: readonly DrawnLayer[]): RulerTick[] {
  const layers = details.interior?.layers ?? [];
  if (layers.length === 0 || drawn.length !== layers.length) return [];
  const radius = details.interior?.radiusKm;
  const out: RulerTick[] = [{ kind: 'surface', r: 1, value: '0 km', estimate: false }];
  for (let i = 0; i < layers.length - 1; i++) {
    const upper = layers[i];
    const lower = layers[i + 1];
    // The boundary as the layer above states its bottom, else as the layer below states its top.
    const [owner, bound, which] = sized(upper) ? [upper, upper.innerRadiusKm, 'inner' as const] : sized(lower) ? [lower, lower.outerRadiusKm, 'outer' as const] : [null, null, null];
    const value = owner && bound ? depthText(bound, radius?.value, !!boundWording(bodyId, owner.id, which!).about) : null;
    out.push({
      kind: 'boundary',
      r: drawn[i]!.inner,
      value,
      ...(value && bound ? { sourceId: bound.sourceId } : {}),
      estimate: !!value && owner?.estimate === true,
    });
  }
  out.push({ kind: 'centre', r: 0, value: radius ? `${formatNumber(radius.value)} km` : null, ...(radius ? { sourceId: radius.sourceId } : {}), estimate: false });
  return out;
}

/** Gap from the spine to the values, and the margins kept to the viewport edge and to reserved parts, px. */
const VALUE_LEFT = 12;
const MARGIN = 8;
const GAP = 6;
const SPINE_HALF = 5;

export interface RulerInput {
  /** The spine's x and each tick's y (surface first, centre last), screen px. */
  x: number;
  ys: readonly number[];
  /** Measured size of each tick's value (0 x 0 for a tick with no number), and of the title above the scale. */
  sizes: readonly Size[];
  title: Size;
}

export interface RulerPlacement {
  /** full: ticks and values; compact: ticks only (values would cross something); hidden. */
  mode: 'full' | 'compact' | 'hidden';
  /** Centre y of each value (pushed down where ticks crowd). */
  valueYs: number[];
  /** What the ruler covers, for the label layout to keep clear of. */
  rect: Rect;
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inside = (r: Rect, vp: Size) => r.left >= MARGIN && r.top >= MARGIN && r.right <= vp.width - MARGIN && r.bottom <= vp.height - MARGIN;

/**
 * Where the depth ruler goes: a spine at `x` from the surface tick to the centre tick, values to its right. Values whose ticks
 * crowd (Earth's 30 km crust under the 0 km surface) are pushed down so none overlap. If the values would cross a reserved
 * part (the layer card, the top bar, the strip) or leave the screen, only the ticks show; if even those would, it hides.
 */
export function placeRuler(input: RulerInput, viewport: Size, reserved: readonly Rect[]): RulerPlacement {
  const { x, ys, sizes, title } = input;
  const hidden: RulerPlacement = { mode: 'hidden', valueYs: [], rect: { left: x, top: 0, right: x, bottom: 0 } };
  if (ys.length < 2 || !Number.isFinite(x) || ys.some((y) => !Number.isFinite(y))) return hidden;
  const valueYs: number[] = [];
  let floor = -Infinity;
  ys.forEach((y, i) => {
    const h = sizes[i]?.height ?? 0;
    const centre = h > 0 ? Math.max(y, floor + h / 2) : y;
    valueYs.push(centre);
    if (h > 0) floor = centre + h / 2;
  });
  const top = Math.min(ys[0]!, ...valueYs.map((y, i) => y - (sizes[i]?.height ?? 0) / 2)) - title.height;
  const bottom = Math.max(ys.at(-1)!, ...valueYs.map((y, i) => y + (sizes[i]?.height ?? 0) / 2));
  const widest = Math.max(title.width, ...sizes.map((s) => (s.width > 0 ? VALUE_LEFT + s.width : 0)));
  const blocked = reserved.map((r) => ({ left: r.left - GAP, top: r.top - GAP, right: r.right + GAP, bottom: r.bottom + GAP }));
  const clear = (r: Rect) => inside(r, viewport) && !blocked.some((b) => overlaps(r, b));
  const full: Rect = { left: x - SPINE_HALF, top, right: x + widest, bottom };
  if (clear(full)) return { mode: 'full', valueYs, rect: full };
  const compact: Rect = { left: x - SPINE_HALF, top: ys[0]!, right: x + SPINE_HALF, bottom: ys.at(-1)! };
  if (clear(compact)) return { mode: 'compact', valueYs, rect: compact };
  return hidden;
}
