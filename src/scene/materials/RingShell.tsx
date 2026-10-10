import { useEffect, useMemo } from 'react';
import { DoubleSide, RingGeometry, Vector2 } from 'three';
import type { Body } from '../../core/catalog/schema';
import { useTieredTexture } from '../textures/useTieredTexture';
import { FRAG_OUTRO } from './chunks';
import { createBodyMaterial } from './createBodyMaterial';
import { RING_UNLIT_SCALE } from './illustrative';
import { ringRadii } from './rings';
import { useBodyUniforms } from './useBodyUniforms';

const FRAGMENT = /* glsl */ `
uniform sampler2D uRingMap;
uniform vec2 uRingRadii;
void main() {
  float r = length(vPlane);
  float x = (r - uRingRadii.x) / max(uRingRadii.y - uRingRadii.x, 1e-6);
  if (x < 0.0 || x > 1.0) discard;
  vec4 ring = texture2D(uRingMap, vec2(clamp(x, 0.0005, 0.9995), 0.5));
  if (ring.a < 0.004) discard;
  vec3 p = vec3(vPlane, 0.0);
  vec3 v = normalize(uCamObj - p);
  float mu0 = abs(uSunDirObj.z);
  float mu = max(abs(v.z), 1e-3);
  bool litFace = uSunDirObj.z * v.z >= 0.0;
  // Lit face: Lommel-Seeliger. Unlit face: light diffusing through the layer, peaking at medium optical depth.
  float reflected = 2.0 * mu0 / max(mu0 + mu, 1e-3);
  float transmitted = ${RING_UNLIT_SCALE.toFixed(4)} * 4.0 * ring.a * (1.0 - ring.a) * mu0 / max(mu0 + mu, 1e-3);
  float brightness = litFace ? reflected : transmitted;
  // Forward scattering by fine dust when looking toward the Sun through the rings (illustrative strength).
  float forward = pow(max(dot(-uSunDirObj, v), 0.0), 12.0) * (1.0 - ring.a) * 1.5;
  float shadow = rayHitsEllipsoid(p, uSunDirObj, uFlattening) ? 0.0 : 1.0;
  vec3 color = ring.rgb * (brightness + forward) * shadow * uSunIntensity + ring.rgb * 0.01 * uFill;
  gl_FragColor = vec4(color, ring.a);
  ${FRAG_OUTRO}
}`;

export function RingShell({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const radii = ringRadii(body)!;
  // No mipmaps: the fragment samples after a discard (ledger ruling).
  const texture = useTieredTexture(body.imagery?.rings?.texture, { maxTier: '2k', srgb: true, mipmaps: false });
  const geometry = useMemo(() => new RingGeometry(radii.inner, radii.outer, 256, 1), [radii.inner, radii.outer]);
  const material = useMemo(
    () =>
      createBodyMaterial({
        fragment: FRAGMENT,
        uniforms: { uRingMap: { value: null }, uRingRadii: { value: new Vector2(radii.inner, radii.outer) } },
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      }),
    [radii.inner, radii.outer],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  material.uniforms.uRingMap!.value = texture;
  useBodyUniforms(body, [material], bodies);
  if (!texture) return null;
  return <mesh geometry={geometry} material={material} raycast={() => null} renderOrder={3} />;
}

