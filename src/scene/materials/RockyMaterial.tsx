import { useMemo } from 'react';
import { Color } from 'three';
import type { Body } from '../../core/catalog/schema';
import { useViewStore } from '../../state/viewStore';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform sampler2D uColorMap;
uniform sampler2D uNormalMap;
uniform float uHasColor;
uniform float uHasNormal;
uniform float uNormalStrength;
uniform float uLommelSeeliger;
uniform vec3 uFallbackColor;
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  vec3 nb = uHasNormal > 0.5 ? perturbNormal(n, texture2D(uNormalMap, vUv).xyz, uNormalStrength) : n;
  vec3 v = normalize(uCamObj - s);
  float geoMu0 = dot(n, uSunDirObj);
  float mu0 = max(dot(nb, uSunDirObj), 0.0);
  float mu = max(dot(n, v), 1e-3);
  float brdf = mix(mu0 * step(0.0, geoMu0), lommelSeeliger(mu0, mu, geoMu0), uLommelSeeliger);
  vec3 albedo = uHasColor > 0.5 ? texture2D(uColorMap, vUv).rgb : uFallbackColor;
  vec3 color = albedo * brdf * uSunIntensity * eclipseFactor(s) + cinematicFill(albedo, n, v);
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO}
}`;

export function RockyMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const tier = useViewStore((s) => s.textureTier);
  const color = useTieredTexture(body.imagery?.color, { maxTier: tier, srgb: true });
  const normal = useTieredTexture(body.imagery?.normal, { maxTier: tier, srgb: false });
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: {
          uColorMap: { value: null },
          uNormalMap: { value: null },
          uHasColor: { value: 0 },
          uHasNormal: { value: 0 },
          uNormalStrength: { value: body.render.normalStrength },
          uLommelSeeliger: { value: body.render.lommelSeeliger },
          uFallbackColor: { value: new Color(body.display.color) },
        },
      }),
    [body.render.normalStrength, body.render.lommelSeeliger, body.display.color],
  );
  material.uniforms.uColorMap!.value = color;
  material.uniforms.uHasColor!.value = color ? 1 : 0;
  material.uniforms.uNormalMap!.value = normal;
  material.uniforms.uHasNormal!.value = normal ? 1 : 0;
  useBodyUniforms(body, [material], bodies);
  return <primitive object={material} attach="material" />;
}
