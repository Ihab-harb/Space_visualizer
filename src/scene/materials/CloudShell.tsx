import { useEffect, useMemo } from 'react';
import { SphereGeometry } from 'three';
import type { Body } from '../../core/catalog/schema';
import { useViewStore } from '../../state/viewStore';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { CLOUD_DRIFT_PER_DAY } from './EarthMaterial';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform sampler2D uCloudMap;
uniform sampler2D uNightMap;
uniform float uCloudDrift;
void main() {
  vec3 s = surfacePoint(vUnit) * 1.006;
  vec3 n = surfaceNormal(vUnit);
  vec3 v = normalize(uCamObj - s);
  float geo = dot(n, uSunDirObj);
  float a = texture2D(uCloudMap, vUv - vec2(uSimDays * uCloudDrift, 0.0)).r;
  vec3 sunColor = mix(vec3(1.0, 0.5, 0.3), vec3(1.0), smoothstep(0.0, 0.3, geo));
  vec3 lit = vec3(1.0) * max(geo, 0.0) * sunColor * uSunIntensity * eclipseFactor(s);
  float night = 1.0 - smoothstep(-0.18, 0.06, geo);
  vec3 glow = texture2D(uNightMap, vUv).rgb * night * 0.25 * vec3(1.0, 0.8, 0.55);
  vec3 color = lit + glow + cinematicFill(vec3(1.0), n, v) * 0.6;
  gl_FragColor = vec4(color, a * (0.25 + 0.75 * smoothstep(-0.25, 0.1, geo)));
  ${FRAG_OUTRO}
}`;

export function CloudShell({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const tier = useViewStore((s) => s.textureTier);
  const clouds = useTieredTexture(body.imagery?.clouds, { maxTier: tier, srgb: false });
  const night = useTieredTexture(body.imagery?.night, { maxTier: tier, srgb: true });
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 128, 64);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const material = useMemo(
    () => createBodyMaterial({ fragment: FRAGMENT, uniforms: { uCloudMap: { value: null }, uNightMap: { value: null }, uCloudDrift: { value: CLOUD_DRIFT_PER_DAY } }, transparent: true, depthWrite: false }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  material.uniforms.uCloudMap!.value = clouds;
  material.uniforms.uNightMap!.value = night;
  useBodyUniforms(body, [material], bodies);
  if (!clouds) return null;
  return <mesh geometry={geometry} material={material} scale={1.006} raycast={() => null} renderOrder={1} />;
}
