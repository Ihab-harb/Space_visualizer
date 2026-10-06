import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float threshold;
uniform float strength;
uniform float spreadPx;
uniform float maxExcess;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float sum = 0.0;
  float wsum = 0.0;
  // Per-pixel jitter (interleaved gradient noise) of the tap positions: with taps spreadPx apart, a sharp highlight edge
  // would otherwise be repeated as distinct copies; jittered taps average into a continuous streak.
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  for (int i = -12; i <= 12; i++) {
    float fi = float(i) + jitter;
    vec3 c = texture2D(inputBuffer, uv + vec2(fi * spreadPx * texelSize.x, 0.0)).rgb;
    float w = exp(-abs(fi) / 5.0);
    // Excess of the brightest channel, so a warm highlight still gives the classic blue-white streak (tint below).
    // Bounded by maxExcess, so a transient HDR spike cannot smear copies of a whole limb across the frame; NaN reads as 0.
    float e = max(c.r, max(c.g, c.b)) - threshold;
    e = e > 0.0 ? min(e, maxExcess) : 0.0;
    sum += e * w;
    wsum += w;
  }
  vec3 streak = (sum / wsum) * strength * vec3(0.55, 0.75, 1.0);
  outputColor = vec4(inputColor.rgb + streak, inputColor.a);
}`;

/** Horizontal streaks from the brightest HDR highlights (illustrative camera effect). */
export class AnamorphicStreakEffect extends Effect {
  constructor({
    threshold = 2,
    strength = 0.8,
    spreadPx = 6,
    maxExcess = 4,
  }: { threshold?: number; strength?: number; spreadPx?: number; maxExcess?: number } = {}) {
    super('AnamorphicStreakEffect', FRAGMENT, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['threshold', new Uniform(threshold)],
        ['strength', new Uniform(strength)],
        ['spreadPx', new Uniform(spreadPx)],
        ['maxExcess', new Uniform(maxExcess)],
      ]),
    });
  }
}
