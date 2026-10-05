import type { PassId } from './quality';

/**
 * postprocessing's EffectAttribute bits for each HDR-stage effect (CONVOLUTION = 2, DEPTH = 1, none = 0).
 * EffectPass re-sorts the effects it merges by attributes, descending, so a run that is not already in
 * non-increasing order would be silently reordered. Splitting at every increase keeps the composer's
 * assembly identical to the spec order that data-fx reports.
 */
const ATTRIBUTES: Partial<Record<PassId, number>> = { bloom: 0, rays: 1, flare: 0, streaks: 2, dof: 1, exposure: 0, tonemap: 0 };

export function segmentByAttributes(passes: readonly PassId[]): PassId[][] {
  const segments: PassId[][] = [];
  for (const pass of passes) {
    const last = segments[segments.length - 1];
    const prev = last?.[last.length - 1];
    if (last && prev !== undefined && (ATTRIBUTES[pass] ?? 0) <= (ATTRIBUTES[prev] ?? 0)) last.push(pass);
    else segments.push([pass]);
  }
  return segments;
}
