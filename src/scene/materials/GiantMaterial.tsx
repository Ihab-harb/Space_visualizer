import { useEffect, useMemo } from 'react';
import { Color, Vector2 } from 'three';
import type { Body } from '../../core/catalog/schema';
import { useViewStore } from '../../state/viewStore';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { ringRadii } from './rings';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform sampler2D uColorMap;
uniform float uHasColor;
uniform vec3 uFallbackColor;
uniform sampler2D uRingMap;
uniform float uHasRings;
uniform vec2 uRingRadii;
uniform float uBandFlow;
uniform vec3 uHazeColor;
/** Sunlight let through the rings on the way to point p (1 = no ring in the way). */
float ringTransmission(vec3 p) {
  if (uHasRings < 0.5 || abs(uSunDirObj.z) < 1e-4) return 1.0;
  float t = -p.z / uSunDirObj.z;
  if (t <= 0.0) return 1.0;
  float r = length(p.xy + uSunDirObj.xy * t);
  if (r < uRingRadii.x || r > uRingRadii.y) return 1.0;
  float x = clamp((r - uRingRadii.x) / (uRingRadii.y - uRingRadii.x), 0.0005, 0.9995);
  return 1.0 - 0.9 * texture2D(uRingMap, vec2(x, 0.5)).a;
}
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  vec3 v = normalize(uCamObj - s);
  vec2 uv = vUv;
  if (uBandFlow > 0.5) {
    uv.x += 0.0015 * fbm(vec3(vUnit.xy * 6.0, vUnit.z * 24.0) + vec3(0.0, 0.0, uTime * 0.01));
    uv.y += 0.0004 * snoise(vUnit * 12.0 + vec3(uTime * 0.02));
  }
  vec3 albedo = uHasColor > 0.5 ? texture2D(uColorMap, uv).rgb : uFallbackColor;
  float mu0 = max(dot(n, uSunDirObj), 0.0);
  float mu = max(dot(n, v), 0.05);
  // Minnaert limb darkening (k = 0.85), illustrative.
  float diffuse = pow(mu0, 0.85) * pow(mu, -0.15);
  float light = diffuse * uSunIntensity * eclipseFactor(s) * ringTransmission(s);
  // Thin high haze brightening the sunlit limb.
  vec3 haze = uHazeColor * pow(clamp(1.0 - mu, 0.0, 1.0), 3.0) * smoothstep(-0.1, 0.3, dot(n, uSunDirObj)) * 0.35;
  vec3 color = albedo * light + haze * uSunIntensity + cinematicFill(albedo, n, v);
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO}
}`;

export function GiantMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const tier = useViewStore((s) => s.textureTier);
  const color = useTieredTexture(body.imagery?.color, { maxTier: tier, srgb: true });
  const rings = useTieredTexture(body.imagery?.rings?.texture, { maxTier: '2k', srgb: true });
  const radii = ringRadii(body);
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: {
          uColorMap: { value: null },
          uHasColor: { value: 0 },
          uFallbackColor: { value: new Color(body.display.color) },
          uRingMap: { value: null },
          uHasRings: { value: 0 },
          uRingRadii: { value: new Vector2(radii?.inner ?? 0, radii?.outer ?? 0) },
          uBandFlow: { value: body.render.bandFlow ? 1 : 0 },
          uHazeColor: { value: new Color(body.display.color).lerp(new Color('#9fc4ff'), 0.5) },
        },
      }),
    [body.display.color, body.render.bandFlow, radii?.inner, radii?.outer],
  );
  useEffect(() => () => material.dispose(), [material]);
  material.uniforms.uColorMap!.value = color;
  material.uniforms.uHasColor!.value = color ? 1 : 0;
  material.uniforms.uRingMap!.value = rings;
  material.uniforms.uHasRings!.value = rings && radii ? 1 : 0;
  useBodyUniforms(body, [material], bodies);
  return <primitive object={material} attach="material" />;
}
