import type { PassId } from './quality';

/**
 * postprocessing's EffectAttribute bits for each HDR-stage effect (CONVOLUTION = 2, DEPTH = 1, none = 0).
 * EffectPass re-sorts the effects it merges by attributes, descending, so a run that is not already in
 * non-increasing order would be silently reordered. Splitting at every increase keeps the composer's
 * assembly identical to the spec order that data-fx reports.
 */
const ATTRIBUTES: Partial<Record<PassId, number>> = { bloom: 0, rays: 1, flare: 0, streaks: 2, dof: 1, exposure: 0, tonemap: 0 };

/**
 * Depth of field composites from buffers it builds out of its pass's input buffer, so anything merged into the same pass
 * before it (the streaks) never reaches those buffers and is multiplied away where the circle of confusion is large.
 * It must therefore start a pass.
 */
const STARTS_PASS: ReadonlySet<PassId> = new Set<PassId>(['dof']);

export function segmentByAttributes(passes: readonly PassId[]): PassId[][] {
  const segments: PassId[][] = [];
  for (const pass of passes) {
    const last = segments[segments.length - 1];
    const prev = last?.[last.length - 1];
    if (last && prev !== undefined && !STARTS_PASS.has(pass) && (ATTRIBUTES[pass] ?? 0) <= (ATTRIBUTES[prev] ?? 0)) last.push(pass);
    else segments.push([pass]);
  }
  return segments;
}
