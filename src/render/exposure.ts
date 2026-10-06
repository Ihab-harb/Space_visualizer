/** Scene-driven exposure (plan scope ruling). */
export const EXPOSURE = {
  minDip: 0.15,
  maxDip: 0.6,
  skyDimAtFull: 0.4,
  fullSizeRad: (5 * Math.PI) / 180,
  damping: 4,
  /** God-ray opacity floor when the Sun is large on screen; full-strength rays saturate a close-up disc. */
  rayCloseUpOpacity: 0.3,
} as const;

/** Sun visibility scaled by how much of it is in frame; fades out between NDC edge 1 and 1.3. null = behind the camera. */
export function sunFrameWeight(sunVisible: number, ndc: readonly [number, number] | null): number {
  if (!ndc) return 0;
  const edge = Math.max(Math.abs(ndc[0]), Math.abs(ndc[1]));
  const onScreen = edge <= 1 ? 1 : edge >= 1.3 ? 0 : 1 - (edge - 1) / 0.3;
  return sunVisible * onScreen;
}

export function sceneExposure(weight: number, sunAngularRadiusRad: number): { exposure: number; skyDim: number } {
  const size = Math.min(1, Math.max(0, sunAngularRadiusRad / EXPOSURE.fullSizeRad));
  const dip = EXPOSURE.minDip + (EXPOSURE.maxDip - EXPOSURE.minDip) * size;
  return { exposure: 1 - weight * dip, skyDim: 1 - weight * (1 - EXPOSURE.skyDimAtFull) };
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** God-ray blend opacity: the visible fraction, eased down to rayCloseUpOpacity as the Sun grows toward fullSizeRad. */
export function godRayOpacity(visible: number, inFront: boolean, angularRadiusRad: number): number {
  if (!inFront) return 0;
  const size = Math.min(1, Math.max(0, angularRadiusRad / EXPOSURE.fullSizeRad));
  return visible * (1 + (EXPOSURE.rayCloseUpOpacity - 1) * size);
}
