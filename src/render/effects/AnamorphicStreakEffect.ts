import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float threshold;
uniform float strength;
uniform float spreadPx;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = -12; i <= 12; i++) {
    float fi = float(i);
    vec3 c = texture2D(inputBuffer, uv + vec2(fi * spreadPx * texelSize.x, 0.0)).rgb;
    float w = exp(-abs(fi) / 5.0);
    sum += max(c - vec3(threshold), vec3(0.0)) * w;
    wsum += w;
  }
  vec3 streak = (sum / wsum) * strength * vec3(0.55, 0.75, 1.0);
  outputColor = vec4(inputColor.rgb + streak, inputColor.a);
}`;

/** Horizontal streaks from the brightest HDR highlights (illustrative camera effect). */
export class AnamorphicStreakEffect extends Effect {
  constructor({ threshold = 2, strength = 0.8, spreadPx = 6 }: { threshold?: number; strength?: number; spreadPx?: number } = {}) {
    super('AnamorphicStreakEffect', FRAGMENT, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['threshold', new Uniform(threshold)],
        ['strength', new Uniform(strength)],
        ['spreadPx', new Uniform(spreadPx)],
      ]),
    });
  }
}
