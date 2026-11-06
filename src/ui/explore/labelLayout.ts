/**
 * Floating layer labels in Explore (spec §3.3): each label sits beside the body on its anchor's side, joined to the
 * anchor by a leader line. Labels never overlap each other, the reserved rects (top bar, strip, card, chart) or the
 * viewport edge. On conflict a lower-priority label first moves a little up or down, then collapses to its name, then
 * tries the other side, and is hidden as a last resort. The selected layer goes first, so it always keeps its full label
 * when anything fits. Pure: positions in CSS pixels, origin at the top left of the scene.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Side = 'left' | 'right';

export interface LabelAnchor {
  id: string;
  /** The point on the layer the leader line starts from (projected), CSS px. */
  x: number;
  y: number;
  /** The side of the body the label prefers. */
  side: Side;
  /** Higher keeps its full label first (InteriorLabels: outer layers before inner ones). */
  priority: number;
  /** Measured sizes: the full label (name over detail) and the name alone. */
  full: Size;
  collapsed: Size;
}

export type LabelMode = 'full' | 'collapsed' | 'hidden';

export interface PlacedLabel {
  id: string;
  mode: LabelMode;
  side: Side;
  rect: Rect;
  /** From the anchor to the middle of the label's edge that faces the body; null when hidden. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
}

export interface LayoutOptions {
  /** The body's screen circle: labels are kept outside it horizontally when the viewport allows. */
  body?: { x: number; y: number; r: number };
  /** The selected layer: placed first, so it keeps its full label. */
  selectedId?: string | null;
  /** Kept free at the viewport edge, px. */
  margin?: number;
  /** Kept free between a label and anything else, px. */
  gap?: number;
  /** Horizontal distance from the anchor (or the body's edge) to the label, px. */
  lead?: number;
  /** Furthest a label moves up or down from its anchor, as a fraction of the viewport height. */
  maxShiftFraction?: number;
}

const STEP_PX = 4;

/** Strict overlap of two rects (touching edges do not overlap). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

const grow = (r: Rect, by: number): Rect => ({ left: r.left - by, top: r.top - by, right: r.right + by, bottom: r.bottom + by });
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export function labelLayout(anchors: readonly LabelAnchor[], viewport: Size, reserved: readonly Rect[], opts: LayoutOptions = {}): PlacedLabel[] {
  const margin = opts.margin ?? 8;
  const gap = opts.gap ?? 6;
  const lead = opts.lead ?? 16;
  const maxShift = viewport.height * (opts.maxShiftFraction ?? 0.35);
  const body = opts.body && Number.isFinite(opts.body.x) && Number.isFinite(opts.body.r) ? opts.body : undefined;
  const blocked: Rect[] = reserved.map((r) => grow(r, gap));

  /** Positions for one label size on one side, nearest to the anchor's height first. */
  const candidates = (a: LabelAnchor, size: Size, side: Side): Rect[] => {
    const { width: w, height: h } = size;
    if (!(w > 0 && h > 0) || viewport.width - 2 * margin < w || viewport.height - 2 * margin < h) return [];
    const left =
      side === 'right'
        ? Math.max(a.x + lead, body ? body.x + body.r + lead : -Infinity)
        : Math.min(a.x - lead, body ? body.x - body.r - lead : Infinity) - w;
    const x = clamp(left, margin, viewport.width - margin - w);
    const centred = a.y - h / 2;
    const tops = new Set<number>();
    const out: Rect[] = [];
    for (let k = 0; k * STEP_PX <= maxShift; k++) {
      for (const dy of k === 0 ? [0] : [-k * STEP_PX, k * STEP_PX]) {
        const top = clamp(centred + dy, margin, viewport.height - margin - h);
        if (tops.has(top)) continue;
        tops.add(top);
        out.push({ left: x, top, right: x + w, bottom: top + h });
      }
    }
    return out;
  };

  const order = anchors
    .map((a, i) => ({ a, i, rank: a.id === opts.selectedId ? Infinity : a.priority }))
    .sort((p, q) => q.rank - p.rank || p.i - q.i);
  const placedRects: Rect[] = [];
  const result = new Map<string, PlacedLabel>();
  for (const { a } of order) {
    const other: Side = a.side === 'right' ? 'left' : 'right';
    const attempts: Array<[Exclude<LabelMode, 'hidden'>, Side]> = [
      ['full', a.side],
      ['collapsed', a.side],
      ['full', other],
      ['collapsed', other],
    ];
    let placed: PlacedLabel | null = null;
    if (Number.isFinite(a.x) && Number.isFinite(a.y)) {
      for (const [mode, side] of attempts) {
        const rect = candidates(a, mode === 'full' ? a.full : a.collapsed, side).find(
          (c) => !blocked.some((b) => rectsOverlap(c, b)) && !placedRects.some((p) => rectsOverlap(grow(c, gap), p)),
        );
        if (rect) {
          const y2 = (rect.top + rect.bottom) / 2;
          placed = { id: a.id, mode, side, rect, leader: { x1: a.x, y1: a.y, x2: side === 'right' ? rect.left : rect.right, y2 } };
          placedRects.push(rect);
          break;
        }
      }
    }
    const x = Number.isFinite(a.x) ? a.x : 0;
    const y = Number.isFinite(a.y) ? a.y : 0;
    result.set(a.id, placed ?? { id: a.id, mode: 'hidden', side: a.side, rect: { left: x, top: y, right: x, bottom: y }, leader: null });
  }
  return anchors.map((a) => result.get(a.id)!);
}
