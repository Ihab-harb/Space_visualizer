import type { InteriorLayer, SourcedRange } from '../core/details/schema';
import type { DrawnLayer } from '../core/interior/geometry';
import { formatNumber } from './format';

/**
 * Words a bound's source sentence uses that the built data does not keep (Task 4 research). The numbers stay as stated;
 * only the wording around them is added, so the drawer, the layer card and the floating labels read like the source.
 */
export interface BoundWording {
  about?: boolean;
  note?: string;
}

const WORDING: Readonly<Record<string, BoundWording>> = {
  // Mankovich & Fuller 2021: "extending to approximately 60% of the planet's radius".
  'saturn/diffuse-core/outer': { about: true },
  // Maia & Wieczorek 2022: "the global average crustal thickness of Venus is about 20 km". The mantle's top is the same bound.
  'venus/crust/inner': { about: true, note: 'global average' },
  'venus/mantle/outer': { about: true, note: 'global average' },
};

export function boundWording(bodyId: string, layerId: string, which: 'outer' | 'inner'): BoundWording {
  return WORDING[`${bodyId}/${layerId}/${which}`] ?? {};
}

const rangeText = (min: number, max: number) => (min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`);
const stated = (r: SourcedRange) => r.stated ?? { min: r.min, max: r.max };
const isZero = (r: SourcedRange) => stated(r).min === 0 && stated(r).max === 0;
const about = (w: BoundWording) => (w.about ? 'about ' : '');
const note = (w: BoundWording) => (w.note ? ` (${w.note})` : '');

/** One interior bound in the form its source states it: a depth, a radius, a percent of the radius, or the surface or centre. */
export function boundText(r: SourcedRange, w: BoundWording = {}): string {
  const form = r.from ?? 'radius';
  if (isZero(r)) return form === 'depth' ? 'the surface' : 'the centre';
  const range = rangeText(stated(r).min, stated(r).max);
  if (form === 'depth') return `${about(w)}${range} km deep${note(w)}`;
  if (form === 'percent') return `${about(w)}${range} % of the radius${note(w)}`;
  return `radius ${about(w)}${range} km${note(w)}`;
}

/**
 * Interior display rule (drawer and layer card): each layer reads outside in, "from <outer bound> to <inner bound>", and every
 * bound is printed in the form and with the numbers its source states (km deep, radius in km, or percent of the radius), never
 * a derived figure. The stored radii are untouched; they are for the cutaway, not for display.
 */
export function layerExtent(bodyId: string, layer: InteriorLayer): string {
  const { outerRadiusKm: outer, innerRadiusKm: inner } = layer;
  // An illustrative layer shows no number (the Explore view labels it "Illustrative size").
  if (!outer || !inner) return 'illustrative size';
  const wo = boundWording(bodyId, layer.id, 'outer');
  const wi = boundWording(bodyId, layer.id, 'inner');
  if (outer.from === 'percent' && inner.from === 'percent' && !isZero(inner) && !wo.about && !wi.about) {
    const pct = (r: SourcedRange) => `${rangeText(stated(r).min, stated(r).max)} %`;
    return `from ${pct(outer)} to ${pct(inner)} of the radius`;
  }
  return `from ${boundText(outer, wo)} to ${boundText(inner, wi)}`;
}

export type LayerTag = 'Estimate' | 'Illustrative size';

export interface LayerLabelText {
  name: string;
  /** solid, liquid, gas or plasma; null when the data says unknown. */
  state: string | null;
  stateSourceId: string | undefined;
  /** The short bound for a floating label: where the layer ends inward ("to 30 km deep"), or for the innermost layer its own extent. */
  bound: string | null;
  boundSourceId: string | undefined;
  tag: LayerTag | null;
}

function shortBound(r: SourcedRange, w: BoundWording, lead: string): string {
  const range = `${about(w)}${rangeText(stated(r).min, stated(r).max)}`;
  const form = r.from ?? 'radius';
  if (form === 'depth') return `${lead}${range} km deep${note(w)}`;
  if (form === 'percent') return `${lead}${range} % of the radius${note(w)}`;
  return `${lead}${range} km radius${note(w)}`;
}

/** What a floating label says: name · state · bound [n], with an "Estimate" or "Illustrative size" tag. */
export function layerLabelText(bodyId: string, layer: InteriorLayer, innermost: boolean, drawn?: DrawnLayer): LayerLabelText {
  const illustrative = layer.sizeKind === 'illustrative' || drawn?.sizeKind === 'illustrative' || !layer.outerRadiusKm || !layer.innerRadiusKm;
  const tag: LayerTag | null = illustrative ? 'Illustrative size' : layer.estimate ? 'Estimate' : null;
  let bound: string | null = null;
  let boundSourceId: string | undefined;
  if (!illustrative && layer.outerRadiusKm && layer.innerRadiusKm) {
    const useOuter = innermost || isZero(layer.innerRadiusKm);
    const r = useOuter ? layer.outerRadiusKm : layer.innerRadiusKm;
    bound = isZero(r) ? null : shortBound(r, boundWording(bodyId, layer.id, useOuter ? 'outer' : 'inner'), useOuter ? '' : 'to ');
    boundSourceId = bound ? r.sourceId : undefined;
  }
  return {
    name: layer.name,
    state: layer.state === 'unknown' ? null : layer.state,
    stateSourceId: layer.state === 'unknown' ? undefined : layer.stateSourceId,
    bound,
    boundSourceId,
    tag,
  };
}

/** View-wide notes: an "Estimate" tag when any layer is one; "Layer sizes are not to scale" when every layer is illustrative. */
export function interiorNotes(layers: readonly InteriorLayer[], drawn: readonly DrawnLayer[]): { estimate: boolean; notToScale: boolean } {
  const illustrative = (l: InteriorLayer, i: number) => l.sizeKind === 'illustrative' || drawn[i]?.sizeKind === 'illustrative';
  return { estimate: layers.some((l) => l.estimate === true), notToScale: layers.length > 0 && layers.every(illustrative) };
}
