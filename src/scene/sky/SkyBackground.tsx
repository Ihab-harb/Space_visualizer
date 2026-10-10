import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BackSide, Matrix3, ShaderMaterial, SphereGeometry } from 'three';
import { useRenderStore } from '../../state/renderStore';
import { useSkyStore } from '../../state/skyStore';
import { useFrameState } from '../FrameStateContext';
import { useMaxTier } from '../../render/useMaxTier';
import { useTieredTexture } from '../textures/useTieredTexture';
import { eclipticToEquatorialColumns, skyTier } from './skyMath';

export const SKY_EXPOSURE = 0.55;

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uSky;
uniform mat3 uEclToEq;
uniform float uExposure;
varying vec3 vDir;
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(uEclToEq * normalize(vDir));
  float u = fract(0.5 - atan(d.y, d.x) / (2.0 * PI));
  float v = 0.5 + asin(clamp(d.z, -1.0, 1.0)) / PI;
  gl_FragColor = vec4(texture2D(uSky, vec2(u, v)).rgb * uExposure, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function SkyBackground() {
  const frame = useFrameState();
  const ref = useSkyStore((s) => s.ref);
  const tier = useMaxTier();
  const texture = useTieredTexture(ref ?? undefined, { maxTier: skyTier(tier), srgb: true, mipmaps: false });
  const geometry = useMemo(() => new SphereGeometry(1, 64, 32), []);
  const material = useMemo(() => {
    const [c0, c1, c2] = eclipticToEquatorialColumns();
    // Matrix3.set takes rows; the columns c0..c2 become the matrix columns.
    const m = new Matrix3().set(c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]);
    return new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uSky: { value: null }, uEclToEq: { value: m }, uExposure: { value: SKY_EXPOSURE } },
      side: BackSide,
      depthTest: false,
      depthWrite: false,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    // Stars dim when the Sun fills the frame; with camera effects off the sky stays at its base exposure.
    material.uniforms.uExposure!.value = SKY_EXPOSURE * (useRenderStore.getState().effects ? frame.fx.skyDim : 1);
  });
  material.uniforms.uSky!.value = texture;
  if (!texture) return null;
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-1000} raycast={() => null} />;
}
