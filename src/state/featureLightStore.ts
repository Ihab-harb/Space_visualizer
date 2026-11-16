import { create } from 'zustand';

/**
 * Whether the feature light (illustrative, FEATURE_SPOT) is lighting ground right now: a feature is selected on the Surface
 * tab and it lies where the Sun does not reach. Written by the scene (useBodyUniforms), read by the Explore overlay, which
 * labels the light as illustrative while it shows.
 */
export const useFeatureLightStore = create<{ shown: boolean }>()(() => ({ shown: false }));

/** The label shown on Surface while the feature light is on (the user's ruling, 2026-11-16: "label it"). */
export const FEATURE_LIGHT_LABEL = 'Feature light · illustrative';

/**
 * True when the light adds anything at the feature: it has some strength and the feature (a unit direction in the body frame)
 * is past the point where the shader's day gate closes (n · sun >= 0.3 is full daylight, where the light adds nothing).
 */
export function featureLightShown(strength: number, featureDir: readonly [number, number, number], sunDir: readonly [number, number, number]): boolean {
  return strength > 0 && featureDir[0] * sunDir[0] + featureDir[1] * sunDir[1] + featureDir[2] * sunDir[2] < 0.3;
}
