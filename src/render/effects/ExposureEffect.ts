import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const FRAGMENT = /* glsl */ `
uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}`;

/** Scene-driven exposure (plan scope ruling): multiplies HDR colour before tone mapping. */
export class ExposureEffect extends Effect {
  constructor(exposure = 1) {
    super('ExposureEffect', FRAGMENT, { uniforms: new Map([['exposure', new Uniform(exposure)]]) });
  }
  get exposure(): number {
    return this.uniforms.get('exposure')!.value as number;
  }
  set exposure(value: number) {
    this.uniforms.get('exposure')!.value = value;
  }
}
