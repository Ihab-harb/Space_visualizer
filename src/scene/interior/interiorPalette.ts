import type { Body } from '../../core/catalog/schema';
import type { InteriorLayer } from '../../core/details/schema';

/**
 * Interior colours (spec §6). ILLUSTRATIVE: they follow temperature and state, not a measurement, and the layer card says so.
 * Cool rocky crust and mantle in earth tones, liquid metal glowing amber, a solid inner core near white, the Sun's plasma
 * orange to white, and the giants' hydrogen layers blue to violet (the ice giants blue to teal). Deeper is always brighter.
 */
export type InteriorKind = 'rocky' | 'gas-giant' | 'ice-giant' | 'star';
export type LayerState = InteriorLayer['state'];
/** `rgb` is linear (0 to 1); `glow` is the emissive strength the interior shaders multiply it by. */
export interface InteriorColour { rgb: [number, number, number]; glow: number }

type Stop = readonly [depth: number, hex: string];
interface Ramp { stops: readonly Stop[]; glow: readonly [number, number] }

/** Illustrative ramps, sRGB stops by depth (0 surface, 1 centre). Tuned on the Explore screenshots (Task 6). */
export const RAMPS = {
  crust: { stops: [[0, '#665850'], [1, '#7a6a5e']], glow: [0.1, 0.2] },
  rock: { stops: [[0, '#8a3f22'], [0.5, '#c25a2a'], [1, '#e07a3c']], glow: [0.2, 0.55] },
  liquidMetal: { stops: [[0, '#d8500a'], [0.5, '#f06a0e'], [1, '#ff9a1e']], glow: [1.4, 2.0] },
  solidCore: { stops: [[0, '#ffd9a0'], [1, '#fffaf0']], glow: [2.2, 2.8] },
  plasma: { stops: [[0, '#ff4a12'], [0.5, '#ff9a30'], [1, '#fff0c0']], glow: [1.2, 2.6] },
  hydrogen: { stops: [[0, '#1f3fa8'], [0.25, '#3a36c0'], [0.45, '#6a3ccc'], [0.8, '#a676ec'], [1, '#d6c0ff']], glow: [0.45, 1.05] },
  ices: { stops: [[0, '#2a6ad0'], [0.5, '#22a9c4'], [1, '#bff0ff']], glow: [0.45, 1.05] },
} as const satisfies Record<string, Ramp>;

/** A solid layer this deep in a rocky body is an inner core (near white); shallower solid rock is crust or mantle. */
const SOLID_CORE_DEPTH = 0.75;
/** A rocky layer of unknown state this deep is drawn as hot metal (Mercury's, Venus's and the Moon's cores). */
const METAL_DEPTH = 0.5;
/** Rock whose middle lies this close to the surface is crust: cooler and greyer than the mantle, so the two read apart. */
const CRUST_DEPTH = 0.05;
/** How much of the ramp a layer spans across its thickness (1 = the full depth range; less steps layers apart). */
const LAYER_GRADIENT = 0.4;

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexToLinear = (hex: string): [number, number, number] => [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

function sample(ramp: Ramp, depth: number): InteriorColour {
  const d = clamp01(depth);
  const stops = ramp.stops;
  let i = 0;
  while (i < stops.length - 2 && d > stops[i + 1]![0]) i++;
  const [d0, h0] = stops[i]!;
  const [d1, h1] = stops[i + 1]!;
  const t = d1 > d0 ? clamp01((d - d0) / (d1 - d0)) : 0;
  const a = hexToLinear(h0);
  const b = hexToLinear(h1);
  return { rgb: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], glow: ramp.glow[0] + (ramp.glow[1] - ramp.glow[0]) * d };
}

function pickRamp(state: LayerState, d: number, kind: InteriorKind): Ramp {
  if (kind === 'star') return RAMPS.plasma;
  if (kind === 'gas-giant') return RAMPS.hydrogen;
  if (kind === 'ice-giant') return RAMPS.ices;
  if (state === 'plasma') return RAMPS.plasma;
  if (state === 'liquid') return RAMPS.liquidMetal;
  if (state === 'solid' && d >= SOLID_CORE_DEPTH) return RAMPS.solidCore;
  if (state === 'unknown' && d >= METAL_DEPTH) return RAMPS.liquidMetal;
  return d < CRUST_DEPTH ? RAMPS.crust : RAMPS.rock;
}

/** The illustrative colour of interior matter in a given state at a depth fraction (0 surface, 1 centre). */
export function interiorPalette(state: LayerState, depthFraction: number, kind: InteriorKind): InteriorColour {
  const d = clamp01(depthFraction);
  return sample(pickRamp(state, d, kind), d);
}

/**
 * Colours at a layer's top and bottom (radii as fractions, outer > inner). The ramp is chosen once, at the layer's middle,
 * so a thick layer never changes family across its thickness (the Moon's solid mantle stays rock all the way down).
 */
export function layerColours(state: LayerState, outer: number, inner: number, kind: InteriorKind): { top: InteriorColour; bottom: InteriorColour } {
  const mid = clamp01(1 - (outer + inner) / 2);
  const ramp = pickRamp(state, mid, kind);
  // A gentle gradient around the layer's own colour: neighbouring layers then step apart as clean rings (spec §6).
  return { top: sample(ramp, mid + (1 - outer - mid) * LAYER_GRADIENT), bottom: sample(ramp, mid + (1 - inner - mid) * LAYER_GRADIENT) };
}

/** NASA calls Uranus and Neptune ice giants; their interiors get the ices ramp. */
const ICE_GIANTS = new Set(['uranus', 'neptune']);

export function interiorKind(body: Body): InteriorKind {
  if (body.category === 'star') return 'star';
  if (body.render.shader === 'giant') return ICE_GIANTS.has(body.id) ? 'ice-giant' : 'gas-giant';
  return 'rocky';
}
