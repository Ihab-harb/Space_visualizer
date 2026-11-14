import { findUnresolvedSources } from '../catalog/references';
import type { BodyDetails, InteriorLayer } from './schema';

const EPS = 1e-6;
/** Gap or overlap allowed between consecutive layers: sources round their boundaries independently. */
const touchTol = (radiusKm: number) => Math.max(40, 0.005 * radiusKm);
const validDate = (d: string) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

export interface LayerRange {
  outer: { min: number; max: number };
  inner: { min: number; max: number };
  /** True when the radii were shared out between cited neighbours, not stated. */
  shared: boolean;
}

const hasBounds = (l: InteriorLayer) => l.outerRadiusKm !== undefined && l.innerRadiusKm !== undefined;
const midpoint = (r: { min: number; max: number }) => (r.min + r.max) / 2;

/**
 * The radius range of each layer, outside in. A layer with both bounds keeps them. A run of layers without bounds (illustrative
 * size) shares the room evenly between the inner edge of the cited layer above it (or the body radius if none) and the outer edge
 * of the cited layer below it (or the centre if none). A cited edge that is a range counts at its midpoint.
 */
export function resolveLayerRanges(layers: readonly InteriorLayer[], radiusKm: number): LayerRange[] {
  const out: LayerRange[] = [];
  let i = 0;
  while (i < layers.length) {
    const layer = layers[i]!;
    if (hasBounds(layer)) {
      out.push({ outer: layer.outerRadiusKm!, inner: layer.innerRadiusKm!, shared: false });
      i++;
      continue;
    }
    let j = i;
    while (j < layers.length && !hasBounds(layers[j]!)) j++;
    const top = i === 0 ? radiusKm : midpoint(out[i - 1]!.inner);
    const bottom = j === layers.length ? 0 : midpoint(layers[j]!.outerRadiusKm!);
    const n = j - i;
    for (let k = 0; k < n; k++) {
      const edge = (t: number) => top - ((top - bottom) * t) / n;
      const o = k === 0 ? top : edge(k);
      const inn = k === n - 1 ? bottom : edge(k + 1);
      out.push({ outer: { min: o, max: o }, inner: { min: inn, max: inn }, shared: true });
    }
    i = j;
  }
  return out;
}

/** Most layers the cutaway draws (its shaders hold a fixed-size layer table). More would be dropped silently, so the build fails. */
export const MAX_INTERIOR_LAYERS = 8;

/** Spec §5 build checks. Returns one message per failed rule; empty means the file is consistent. */
export function checkDetails(details: BodyDetails, ctx: { radiusKm: number; knownSources: ReadonlySet<string> }): string[] {
  const p = `details/${details.bodyId}.json:`;
  const errors: string[] = [];
  const layers = details.interior?.layers ?? [];
  const ranges = resolveLayerRanges(layers, ctx.radiusKm);
  if (layers.length > MAX_INTERIOR_LAYERS) errors.push(`${p} interior has ${layers.length} layers; the cutaway draws at most ${MAX_INTERIOR_LAYERS}`);
  const stated = details.interior?.radiusKm;
  if (stated && Math.abs(stated.value - ctx.radiusKm) > EPS) errors.push(`${p} interior radius ${stated.value} km is not the radius the bounds use (${ctx.radiusKm} km)`);
  layers.forEach((layer, i) => {
    const cur = ranges[i]!;
    if (i === 0 && layer.gradual) errors.push(`${p} interior ${layer.id} is the outermost layer: its outer edge is the surface, not a gradual boundary`);
    if (!hasBounds(layer) && (layer.outerRadiusKm !== undefined || layer.innerRadiusKm !== undefined)) {
      errors.push(`${p} interior illustrative layer ${layer.id} must have both bounds or none`);
    }
    if (cur.shared && cur.outer.min - cur.inner.min <= EPS) {
      errors.push(`${p} interior illustrative layer ${layer.id} has no room between its neighbours`);
    }
    for (const [label, r] of [['outer', cur.outer], ['inner', cur.inner]] as const) {
      if (r.min < -EPS || r.max > ctx.radiusKm * 1.001) errors.push(`${p} interior ${layer.id} ${label} radius ${r.min}-${r.max} km outside 0-${ctx.radiusKm} km`);
    }
    if (cur.inner.min > cur.outer.max + EPS) errors.push(`${p} interior ${layer.id} inner radius above outer radius`);
    const next = ranges[i + 1];
    const nextLayer = layers[i + 1];
    if (next && nextLayer && next.outer.min > cur.outer.max + EPS) errors.push(`${p} interior layers out of order at ${layer.id} -> ${nextLayer.id} (outside in)`);
    const tol = touchTol(ctx.radiusKm);
    if (next && nextLayer && (cur.inner.min > next.outer.max + tol || next.outer.min > cur.inner.max + tol)) {
      errors.push(`${p} interior gap or overlap between ${layer.id} and ${nextLayer.id} (inner ${cur.inner.min}–${cur.inner.max} km vs outer ${next.outer.min}–${next.outer.max} km)`);
    }
  });
  const innermost = layers.at(-1);
  const innermostRange = ranges.at(-1);
  if (innermost && innermostRange && innermostRange.inner.max > EPS) errors.push(`${p} innermost layer ${innermost.id} must have inner radius 0`);
  const atm = details.atmosphere;
  if (atm) {
    const total = atm.major.reduce((s, g) => s + g.amount, 0);
    if (total > 100.5) errors.push(`${p} major gases sum to ${total.toFixed(2)} %, over 100 %`);
    for (const g of atm.numberDensity ?? []) if (!Number.isFinite(g.amount) || g.amount > 1e20) errors.push(`${p} number density of ${g.name} ${g.amount} per cm³ is not finite or is above 10^20`);
    for (const g of atm.minor) if (g.amount >= 1e6) errors.push(`${p} minor gas ${g.formula} ${g.amount} ppm is not below 10^6 ppm`);
  }
  const f = details.features;
  if (f) {
    if (f.items.length > 200) errors.push(`${p} ${f.items.length} features exceeds the 200 cap`);
    if (f.items.length > f.totalApproved.value) errors.push(`${p} ${f.items.length} features exceeds the approved total ${f.totalApproved.value}`);
    for (const it of f.items) {
      if (it.latDeg < -90 || it.latDeg > 90) errors.push(`${p} feature ${it.name} latitude ${it.latDeg} outside [-90, 90]`);
      if (it.lonDegE < 0 || it.lonDegE >= 360) errors.push(`${p} feature ${it.name} longitude ${it.lonDegE} outside [0, 360)`);
      if (!(it.diameterKm > 0)) errors.push(`${p} feature ${it.name} diameter must be > 0`);
    }
  }
  for (const m of details.missions) {
    for (const d of [m.launchDate, m.arrivalDate, m.endDate]) if (d && !validDate(d)) errors.push(`${p} mission ${m.id} has invalid date ${d}`);
    if (m.arrivalDate && m.arrivalDate < m.launchDate) errors.push(`${p} mission ${m.id} arrival ${m.arrivalDate} before launch ${m.launchDate}`);
    if (m.endDate && m.endDate < (m.arrivalDate ?? m.launchDate)) errors.push(`${p} mission ${m.id} end ${m.endDate} before arrival/launch`);
  }
  const mag = details.magnetosphere;
  if (mag.kind === 'dipole') {
    if (!(mag.strengthGaussR3.value > 0)) errors.push(`${p} dipole strength must be > 0`);
    if (mag.tiltDeg && (mag.tiltDeg.value < 0 || mag.tiltDeg.value > 180)) errors.push(`${p} dipole tilt ${mag.tiltDeg.value} outside [0, 180]`);
    if (mag.offsetRadii && (mag.offsetRadii.value < 0 || mag.offsetRadii.value > 1)) errors.push(`${p} dipole offset ${mag.offsetRadii.value} outside [0, 1]`);
  }
  errors.push(...findUnresolvedSources(details, ctx.knownSources).map((e) => `${p} ${e}`));
  return errors;
}
