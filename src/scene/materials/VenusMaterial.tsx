import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { Body } from '../../core/catalog/schema';
import { useFrameState } from '../FrameStateContext';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { venusCloudAngle } from './illustrative';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform float uCloudAngle;
void main() {
  vec3 s = surfacePoint(vUnit);
  vec3 n = surfaceNormal(vUnit);
  vec3 v = normalize(uCamObj - s);
  float c = cos(uCloudAngle);
  float sn = sin(uCloudAngle);
  vec3 q = vec3(c * vUnit.x - sn * vUnit.y, sn * vUnit.x + c * vUnit.y, vUnit.z);
  // Latitude-stretched noise gives zonal bands; a second octave adds the dark UV-absorber streaks.
  float bands = fbm(vec3(q.xy * 2.0, q.z * 9.0));
  float streaks = smoothstep(0.15, 0.6, fbm(vec3(q.xy * 4.0, q.z * 14.0) + 7.3));
  vec3 albedo = mix(vec3(0.86, 0.77, 0.58), vec3(0.98, 0.94, 0.83), clamp(0.5 + 0.5 * bands, 0.0, 1.0)) * (1.0 - 0.12 * streaks);
  float geo = dot(n, uSunDirObj);
  float diffuse = smoothstep(-0.06, 0.25, geo) * max(geo, 0.0) * pow(max(dot(n, v), 0.05), -0.1);
  vec3 color = albedo * diffuse * uSunIntensity * eclipseFactor(s) + cinematicFill(albedo, n, v);
  color = max(color, vec3(0.0));
  if (!(color.r >= 0.0 && color.g >= 0.0 && color.b >= 0.0)) color = vec3(0.0);
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO}
}`;

export function VenusMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const frame = useFrameState();
  const material = useMemo(() => createBodyMaterial({ fragment: FRAGMENT, uniforms: { uCloudAngle: { value: 0 } } }), []);
  useEffect(() => () => material.dispose(), [material]);
  useBodyUniforms(body, [material], bodies);
  useFrame(() => {
    material.uniforms.uCloudAngle!.value = venusCloudAngle(frame.jdTdb);
  }, -0.4);
  return <primitive object={material} attach="material" />;
}
