import type { ScaleMode } from '../state/viewStore';

/** Minimum on-screen radius in readable mode, in CSS pixels. */
export const MIN_PIXELS = { star: 10, body: 5, moon: 3 } as const;

export function pixelsPerRadian(viewportHeightPx: number, fovRad: number): number {
  return viewportHeightPx / fovRad;
}

/** Readable mode never draws a body smaller than minPixels; true mode always uses the real radius. */
export function renderRadiusKm(trueRadiusKm: number, distanceKm: number, mode: ScaleMode, minPixels: number, pxPerRad: number): number {
  if (mode === 'true') return trueRadiusKm;
  return Math.max(trueRadiusKm, (distanceKm * minPixels) / pxPerRad);
}

/** Minimum on-screen radius for a body of this category in readable mode. */
export function minPixelsFor(category: string): number {
  return category === 'star' ? MIN_PIXELS.star : category === 'moon' ? MIN_PIXELS.moon : MIN_PIXELS.body;
}
