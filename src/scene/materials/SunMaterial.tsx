import { useEffect, useMemo } from 'react';
import { Color } from 'three';
import type { Body } from '../../core/catalog/schema';
import { FRAG_OUTRO_NO_TONEMAP } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { LIMB_DARKENING_U } from './illustrative';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  float mu = max(dot(n, normalize(uCamObj - s)), 0.0);
  float limb = 1.0 - ${LIMB_DARKENING_U.toFixed(3)} * (1.0 - mu);
  // Granulation: fine cells drifting slowly in real time; supergranulation as a broad, faint modulation.
  float cells = snoise(vUnit * 140.0 + vec3(0.0, 0.0, uTime * 0.05));
  float broad = fbm(vUnit * 9.0 + vec3(uTime * 0.004));
  float grain = 1.0 + 0.07 * cells + 0.05 * broad;
  vec3 color = uColor * limb * grain * mix(vec3(1.0, 0.72, 0.45), vec3(1.0), mu);
  color = max(color, vec3(0.0));
  if (!(color.r >= 0.0 && color.g >= 0.0 && color.b >= 0.0)) color = vec3(0.0);
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO_NO_TONEMAP}
}`;

export function SunMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const material = useMemo(
    () => createBodyMaterial({ fragment: FRAGMENT, uniforms: { uColor: { value: new Color(body.display.color).multiplyScalar(2.2) } }, toneMapped: false }),
    [body.display.color],
  );
  useEffect(() => () => material.dispose(), [material]);
  useBodyUniforms(body, [material], bodies);
  return <primitive object={material} attach="material" />;
}
