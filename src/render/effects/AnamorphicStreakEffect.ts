import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Horizontal tap offsets (px) on one side of the centre texel. Tap i sits between texels 2i+1 and 2i+2, where bilinear
 * filtering (the composer's buffers use LinearFilter) averages the pair, so taps 2 px apart cover every texel out to the
 * reach: a highlight thinner than the step can never be skipped and repeated as separate copies.
 */
export function streakTapOffsets(reachPx: number): number[] {
  const pairs = Math.max(1, Math.round(reachPx / 2));
  return Array.from({ length: pairs }, (_, i) => 2 * i + 1.5);
}

const FRAGMENT = /* glsl */ `
uniform float threshold;
uniform float strength;
uniform float falloffPx;
uniform float maxExcess;
// Excess of the brightest channel over the threshold, so a warm highlight still gives a blue-white streak (tint below).
// Bounded by maxExcess so one extreme pixel cannot dominate; NaN fails the comparison and reads as 0.
float streakExcess(const in vec2 uv) {
  vec3 c = texture2D(inputBuffer, uv).rgb;
  float e = max(c.r, max(c.g, c.b)) - threshold;
  return e > 0.0 ? min(e, maxExcess) : 0.0;
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float sum = streakExcess(uv);
  float wsum = 1.0;
  // Taps 2 px apart, each between two texels (see streakTapOffsets): gap-free out to 2 * STREAK_PAIRS px.
  for (int i = 0; i < STREAK_PAIRS; i++) {
    float d = 2.0 * float(i) + 1.5;
    float w = exp(-d / falloffPx);
    vec2 o = vec2(d * texelSize.x, 0.0);
    sum += (streakExcess(uv + o) + streakExcess(uv - o)) * w;
    wsum += 2.0 * w;
  }
  vec3 streak = (sum / wsum) * strength * vec3(0.55, 0.75, 1.0);
  outputColor = vec4(inputColor.rgb + streak, inputColor.a);
}`;

/** Horizontal streaks from the brightest HDR highlights (illustrative camera effect). */
export class AnamorphicStreakEffect extends Effect {
  constructor({
    threshold = 2,
    strength = 0.8,
    reachPx = 60,
    falloffPx = 20,
    maxExcess = 4,
  }: { threshold?: number; strength?: number; reachPx?: number; falloffPx?: number; maxExcess?: number } = {}) {
    super('AnamorphicStreakEffect', FRAGMENT, {
      attributes: EffectAttribute.CONVOLUTION,
      defines: new Map([['STREAK_PAIRS', String(streakTapOffsets(reachPx).length)]]),
      uniforms: new Map([
        ['threshold', new Uniform(threshold)],
        ['strength', new Uniform(strength)],
        ['falloffPx', new Uniform(falloffPx)],
        ['maxExcess', new Uniform(maxExcess)],
      ]),
    });
  }
}
