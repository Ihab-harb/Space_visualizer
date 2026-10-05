import type { Tier } from '../core/catalog/schema';

export type QualityLevel = 'high' | 'medium' | 'low';
export type QualityMode = 'auto' | QualityLevel;

export const LEVELS_LOW_TO_HIGH: readonly QualityLevel[] = ['low', 'medium', 'high'];

export interface QualityPreset {
  maxPixelRatio: number;
  /** [widthSegments, heightSegments] for body spheres. */
  sphereSegments: readonly [number, number];
  maxTier: Tier;
  atmosphereSamples: number;
  bloomLevels: number;
  /** Depth of field, grain, chromatic aberration and streaks. */
  detailFx: 'full' | 'light' | 'off';
  sunRays: boolean;
}

/** Spec §5 quality table. */
export const PRESETS: Record<QualityLevel, QualityPreset> = {
  high: { maxPixelRatio: 2, sphereSegments: [192, 96], maxTier: '8k', atmosphereSamples: 16, bloomLevels: 8, detailFx: 'full', sunRays: true },
  medium: { maxPixelRatio: 1.25, sphereSegments: [96, 48], maxTier: '2k', atmosphereSamples: 8, bloomLevels: 5, detailFx: 'light', sunRays: true },
  low: { maxPixelRatio: 1, sphereSegments: [48, 24], maxTier: '1k', atmosphereSamples: 4, bloomLevels: 3, detailFx: 'off', sunRays: false },
};

export function pixelRatioFor(level: QualityLevel, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, PRESETS[level].maxPixelRatio);
}

/** Phones (coarse pointer and a narrow viewport) start at Low. */
export function initialLevel(env: { coarsePointer: boolean; viewportWidth: number }): QualityLevel {
  return env.coarsePointer && env.viewportWidth < 900 ? 'low' : 'high';
}

const MODE_CYCLE: readonly QualityMode[] = ['auto', 'high', 'medium', 'low'];
export function nextMode(mode: QualityMode): QualityMode {
  return MODE_CYCLE[(MODE_CYCLE.indexOf(mode) + 1) % MODE_CYCLE.length]!;
}

export function stepDown(level: QualityLevel): QualityLevel {
  return LEVELS_LOW_TO_HIGH[Math.max(0, LEVELS_LOW_TO_HIGH.indexOf(level) - 1)]!;
}
export function stepUp(level: QualityLevel): QualityLevel {
  return LEVELS_LOW_TO_HIGH[Math.min(LEVELS_LOW_TO_HIGH.length - 1, LEVELS_LOW_TO_HIGH.indexOf(level) + 1)]!;
}

export function parseQualityMode(s: string | null): QualityMode | undefined {
  return s !== null && (MODE_CYCLE as readonly string[]).includes(s) ? (s as QualityMode) : undefined;
}

/** Canvas pixel ratio for a level on this device; the single source for the Canvas dpr prop. */
export function canvasDpr(level: QualityLevel, devicePixelRatio: number | undefined): number {
  return pixelRatioFor(level, devicePixelRatio && devicePixelRatio > 0 ? devicePixelRatio : 1);
}

export type PassId = 'bloom' | 'rays' | 'flare' | 'streaks' | 'dof' | 'exposure' | 'tonemap' | 'chromatic' | 'vignette' | 'grain';

/** Post-processing passes in render order (plan Global Constraints). Effects off keeps bloom and a neutral tone map. */
export function activePasses(level: QualityLevel, effects: boolean, hasFocus: boolean): PassId[] {
  if (!effects) return ['bloom', 'tonemap'];
  const p = PRESETS[level];
  const detail = p.detailFx !== 'off';
  const out: PassId[] = ['bloom'];
  if (p.sunRays) out.push('rays', 'flare');
  if (detail) out.push('streaks');
  if (detail && hasFocus) out.push('dof');
  out.push('exposure', 'tonemap');
  if (detail) out.push('chromatic');
  out.push('vignette');
  if (detail) out.push('grain');
  return out;
}
