/** Readable mode: a satellite is drawn only when it is clear of its parent's disc (spec §6). Binary, no fade. */
export function satelliteShown(input: { separationPx: number; parentRadiusPx: number; selfRadiusPx: number; marginPx?: number }): boolean {
  return input.separationPx > input.parentRadiusPx + input.selfRadiusPx + (input.marginPx ?? 4);
}
