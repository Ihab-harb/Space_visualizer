import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BackSide, Color, SphereGeometry } from 'three';
import type { Body } from '../../core/catalog/schema';
import { FRAG_OUTRO_NO_TONEMAP } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { CORONA_A, CORONA_C, CORONA_FADE_START, CORONA_GAIN, CORONA_K, CORONA_SCALE } from './illustrative';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
void main() {
  vec3 ro = uCamObj;
  vec3 d = vUnit * ${CORONA_SCALE.toFixed(1)} - ro;
  vec3 rd = d / max(length(d), 1e-6);
  float b = length(ro - rd * dot(ro, rd));
  if (!(b >= 1.0)) discard;
  float glow = (${CORONA_A.toFixed(3)} * exp(-${CORONA_K.toFixed(3)} * (b - 1.0)) + ${CORONA_C.toFixed(3)} / (b * b)) * (1.0 - smoothstep(${CORONA_FADE_START.toFixed(3)}, ${CORONA_SCALE.toFixed(3)}, b));
  gl_FragColor = vec4(max(uColor * glow, vec3(0.0)), 1.0);
  ${FRAG_OUTRO_NO_TONEMAP}
}`;

/** Illustrative corona: a back-faced additive shell with a radial glow profile. */
export function CoronaGlow({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const geometry = useMemo(() => new SphereGeometry(1, 64, 32), []);
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: { uColor: { value: new Color(body.display.color).multiplyScalar(CORONA_GAIN) } },
        transparent: true,
        blending: AdditiveBlending,
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [body.display.color],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useBodyUniforms(body, [material], bodies);
  return <mesh geometry={geometry} material={material} scale={CORONA_SCALE} raycast={() => null} renderOrder={2} />;
}
