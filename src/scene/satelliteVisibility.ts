/** Readable mode: a satellite is drawn only when it is clear of its parent's disc (spec §6). Binary, no fade. */
export function satelliteShown(input: { separationPx: number; parentRadiusPx: number; selfRadiusPx: number; marginPx?: number }): boolean {
  return input.separationPx > input.parentRadiusPx + input.selfRadiusPx + (input.marginPx ?? 4);
}

/** True when a body is drawn larger than its real equatorial radius (readable-scale inflation). Tolerance 1e-6, relative. */
export function isInflated(drawnRadiusKm: number, trueRadiusKm: number): boolean {
  return drawnRadiusKm > trueRadiusKm * (1 + 1e-6);
}

/**
 * Spec §6: a satellite is hidden only when the overlap with its parent is an inflation artefact,
 * that is, when either body is drawn larger than its true radius. With true radii on both, it is never hidden.
 */
export function satelliteHidden(input: {
  separationPx: number;
  parentRadiusPx: number;
  selfRadiusPx: number;
  selfInflated: boolean;
  parentInflated: boolean;
  marginPx?: number;
}): boolean {
  if (!input.selfInflated && !input.parentInflated) return false;
  return !satelliteShown(input);
}
