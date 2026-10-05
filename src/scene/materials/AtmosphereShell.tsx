import { useEffect, useMemo } from 'react';
import { AdditiveBlending, SphereGeometry, Vector3 } from 'three';
import type { Body } from '../../core/catalog/schema';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { useBodyUniforms } from './useBodyUniforms';

export interface AtmospherePreset {
  outer: number;
  wavelength: [number, number, number];
  kr: number;
  km: number;
  eSun: number;
  g: number;
  scaleDepth: number;
  intensity: number;
}

/** Earth: O'Neil's defaults. Mars and Venus: illustrative tints (a shorter "wavelength" scatters more of that colour). */
export const ATMOSPHERE_PRESETS: Record<'earth' | 'mars' | 'venus', AtmospherePreset> = {
  earth: { outer: 1.025, wavelength: [0.65, 0.57, 0.475], kr: 0.0025, km: 0.001, eSun: 20, g: -0.95, scaleDepth: 0.25, intensity: 1.0 },
  mars: { outer: 1.015, wavelength: [0.5, 0.58, 0.68], kr: 0.0015, km: 0.0035, eSun: 12, g: -0.85, scaleDepth: 0.25, intensity: 0.3 },
  venus: { outer: 1.035, wavelength: [0.55, 0.6, 0.75], kr: 0.003, km: 0.006, eSun: 18, g: -0.9, scaleDepth: 0.3, intensity: 0.9 },
};

export function atmosphereUniforms(p: AtmospherePreset, samples: number) {
  return {
    uOuter: p.outer,
    uInvWavelength: p.wavelength.map((w) => 1 / Math.pow(w, 4)) as [number, number, number],
    uKrESun: p.kr * p.eSun,
    uKmESun: p.km * p.eSun,
    uKr4PI: p.kr * 4 * Math.PI,
    uKm4PI: p.km * 4 * Math.PI,
    uScaleDepth: p.scaleDepth,
    uG: p.g,
    uIntensity: p.intensity,
    uSamples: samples,
  };
}

const FRAGMENT = /* glsl */ `
uniform float uOuter;
uniform vec3 uInvWavelength;
uniform float uKrESun;
uniform float uKmESun;
uniform float uKr4PI;
uniform float uKm4PI;
uniform float uScaleDepth;
uniform float uG;
uniform float uIntensity;
uniform int uSamples;
float scaleFn(float c) {
  float x = 1.0 - c;
  return uScaleDepth * exp(-0.00287 + x * (0.459 + x * (3.83 + x * (-6.80 + x * 5.25))));
}
vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
void main() {
  vec3 ro = uCamObj;
  vec3 rd = normalize(vUnit * uOuter - ro);
  vec2 tOut = raySphere(ro, rd, uOuter);
  if (tOut.y <= 0.0) discard;
  float tNear = max(tOut.x, 0.0);
  float tFar = tOut.y;
  vec2 tIn = raySphere(ro, rd, 1.0);
  if (tIn.x > 0.0) tFar = min(tFar, tIn.x);
  float fScale = 1.0 / (uOuter - 1.0);
  float scaleOverDepth = fScale / uScaleDepth;
  vec3 start = ro + rd * tNear;
  float startOffset = exp(-1.0 / uScaleDepth) * scaleFn(dot(rd, start) / uOuter);
  float segLen = (tFar - tNear) / float(uSamples);
  vec3 front = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uSamples) break;
    vec3 sp = start + rd * segLen * (float(i) + 0.5);
    float h = length(sp);
    float depth = exp(scaleOverDepth * (1.0 - h));
    float scatter = startOffset + depth * (scaleFn(dot(uSunDirObj, sp) / h) - scaleFn(dot(rd, sp) / h));
    vec3 att = exp(-max(scatter, 0.0) * (uInvWavelength * uKr4PI + uKm4PI));
    front += att * depth * segLen * fScale;
  }
  float cosA = dot(uSunDirObj, -rd);
  float g2 = uG * uG;
  float rayleighPhase = 0.75 * (1.0 + cosA * cosA);
  float miePhase = 1.5 * ((1.0 - g2) / (2.0 + g2)) * (1.0 + cosA * cosA) / pow(1.0 + g2 - 2.0 * uG * cosA, 1.5);
  vec3 color = (rayleighPhase * front * uInvWavelength * uKrESun + miePhase * front * uKmESun) * uIntensity * uSunIntensity;
  gl_FragColor = vec4(color, 1.0);
  ${FRAG_OUTRO}
}`;

export function AtmosphereShell({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const preset = ATMOSPHERE_PRESETS[body.render.atmosphere!];
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 96, 48);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const material = useMemo(() => {
    const u = atmosphereUniforms(preset, 8);
    return createBodyMaterial({
      fragment: FRAGMENT,
      uniforms: {
        uOuter: { value: u.uOuter }, uInvWavelength: { value: new Vector3(...u.uInvWavelength) }, uKrESun: { value: u.uKrESun }, uKmESun: { value: u.uKmESun },
        uKr4PI: { value: u.uKr4PI }, uKm4PI: { value: u.uKm4PI }, uScaleDepth: { value: u.uScaleDepth }, uG: { value: u.uG }, uIntensity: { value: u.uIntensity }, uSamples: { value: u.uSamples },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
  }, [preset]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useBodyUniforms(body, [material], bodies);
  return <mesh geometry={geometry} material={material} scale={preset.outer} raycast={() => null} renderOrder={2} />;
}
