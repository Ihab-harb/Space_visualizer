import { useEffect, useMemo } from 'react';
import type { Body } from '../../core/catalog/schema';
import { useMaxTier } from '../../render/useMaxTier';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { CLOUD_SHADOW_OFFSET, GLINT_ROUGHNESS, GLINT_STRENGTH } from './illustrative';
import { useBodyUniforms } from './useBodyUniforms';

/** Illustrative cloud drift: u offset per simulation day. */
export const CLOUD_DRIFT_PER_DAY = 0.0015;

const FRAGMENT = /* glsl */ `
uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uCloudMap;
uniform sampler2D uOceanMask;
uniform sampler2D uNormalMap;
uniform float uReady;
uniform float uNormalStrength;
uniform float uCloudDrift;
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  vec3 v = normalize(uCamObj - s);
  vec3 l = uSunDirObj;
  float geo = dot(n, l);
  float ocean = texture2D(uOceanMask, vUv).r;
  vec3 nb = perturbNormal(n, texture2D(uNormalMap, vUv).xyz, uNormalStrength * (1.0 - ocean));
  vec3 dayColor = texture2D(uDayMap, vUv).rgb;
  // Soft terminator; sunlight reddens at grazing angles.
  float day = smoothstep(-0.10, 0.12, geo);
  vec3 sunColor = mix(vec3(1.0, 0.42, 0.18), vec3(1.0), smoothstep(0.0, 0.35, geo));
  // Cloud shadow: sample the cloud layer offset toward the Sun.
  vec3 east = normalize(vec3(-n.y, n.x, 0.0) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(n, east);
  vec2 drift = vec2(uSimDays * uCloudDrift, 0.0);
  float cloudHere = texture2D(uCloudMap, vUv - drift).r;
  float cloudShadow = texture2D(uCloudMap, vUv - drift + vec2(dot(l, east) / max(length(n.xy), 0.2), dot(l, north)) * ${CLOUD_SHADOW_OFFSET.toFixed(4)}).r;
  float shade = eclipseFactor(s);
  vec3 diffuse = dayColor * max(dot(nb, l), 0.0) * day * sunColor * (1.0 - 0.45 * cloudShadow) * uSunIntensity * shade;
  // Sun glint on water only (GGX).
  float spec = ocean * ggx(n, v, l, ${GLINT_ROUGHNESS.toFixed(4)}) * max(geo, 0.0) * ${GLINT_STRENGTH.toFixed(4)} * (1.0 - cloudHere);
  // City lights on the night side, fading toward the terminator and under clouds.
  float night = 1.0 - smoothstep(-0.18, 0.06, geo);
  vec3 lights = texture2D(uNightMap, vUv).rgb * night * (1.0 - 0.7 * cloudHere) * vec3(1.0, 0.8, 0.55) * 1.4;
  vec3 color = diffuse + spec * sunColor * uSunIntensity * shade + lights + cinematicFill(dayColor, n, v);
  gl_FragColor = vec4(color, uReady);
  ${FRAG_OUTRO}
}`;

export function EarthMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const tier = useMaxTier();
  const day = useTieredTexture(body.imagery?.color, { maxTier: tier, srgb: true });
  const night = useTieredTexture(body.imagery?.night, { maxTier: tier, srgb: true });
  const clouds = useTieredTexture(body.imagery?.clouds, { maxTier: tier, srgb: false });
  const ocean = useTieredTexture(body.imagery?.specular, { maxTier: tier, srgb: false });
  const normal = useTieredTexture(body.imagery?.normal, { maxTier: tier, srgb: false });
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: {
          uDayMap: { value: null }, uNightMap: { value: null }, uCloudMap: { value: null }, uOceanMask: { value: null }, uNormalMap: { value: null },
          uReady: { value: 1 }, uNormalStrength: { value: body.render.normalStrength }, uCloudDrift: { value: CLOUD_DRIFT_PER_DAY },
        },
      }),
    [body.render.normalStrength],
  );
  useEffect(() => () => material.dispose(), [material]);
  material.uniforms.uDayMap!.value = day;
  material.uniforms.uNightMap!.value = night;
  material.uniforms.uCloudMap!.value = clouds;
  material.uniforms.uOceanMask!.value = ocean;
  material.uniforms.uNormalMap!.value = normal;
  useBodyUniforms(body, [material], bodies);
  return <primitive object={material} attach="material" />;
}
