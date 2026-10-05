import { length, scale, type Vec3 } from '../core/math/vec3';

export function dofSettings(distanceKm: number, detail: 'full' | 'light'): { focusRange: number; bokehScale: number } {
  return detail === 'full' ? { focusRange: distanceKm * 0.35, bokehScale: 2 } : { focusRange: distanceKm * 0.6, bokehScale: 1 };
}

/** The point on the body's near surface along the line of sight (camera at the origin). */
export function focusPoint(relKm: Vec3, renderRadiusKm: number): Vec3 {
  const d = length(relKm);
  return d > renderRadiusKm ? scale(relKm, (d - renderRadiusKm) / d) : relKm;
}

/**
 * postprocessing's circle-of-confusion shader converts the depth buffer back to a perspective depth and then to a view
 * position. With this scene's logarithmic depth buffer (near 0.001, far 1e13) that round trip collapses to 1.0 in float32,
 * so it reports garbage distances (the planet blurred, the sky sharp). This version recovers the view-space z directly from the
 * logarithmic depth (z = 2^(depth * log2(far + 1)) - 1, three's own encoding) and scales it to the radial distance.
 */
export const LOG_DEPTH_COC_FRAGMENT = /* glsl */ `
#include <common>
#include <packing>
#ifdef GL_FRAGMENT_PRECISION_HIGH
uniform highp sampler2D depthBuffer;
#else
uniform mediump sampler2D depthBuffer;
#endif
uniform mat4 projectionMatrixInverse;
uniform float cameraFar;
uniform float focusDistance;
uniform float focusRange;
varying vec2 vUv;
void main() {
#if DEPTH_PACKING == 3201
  float depth = unpackRGBAToDepth(texture2D(depthBuffer, vUv));
#else
  float depth = texture2D(depthBuffer, vUv).r;
#endif
  float viewZ = pow(2.0, clamp(depth, 0.0, 1.0) * log2(cameraFar + 1.0)) - 1.0;
  // Unprojecting through the far plane cancels catastrophically in float32; a symmetric frustum needs only its tangents.
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 ray = vec3(ndc.x * projectionMatrixInverse[0][0], ndc.y * projectionMatrixInverse[1][1], 1.0);
  float distanceToCamera = viewZ * length(ray);
  float signedDistance = distanceToCamera - focusDistance;
  float magnitude = smoothstep(0.0, max(focusRange, 1e-6), abs(signedDistance));
  gl_FragColor.rg = magnitude * vec2(step(signedDistance, 0.0), step(0.0, signedDistance));
}`;

export function patchCocForLogDepth(material: { fragmentShader: string; needsUpdate: boolean }): void {
  if (material.fragmentShader === LOG_DEPTH_COC_FRAGMENT) return;
  material.fragmentShader = LOG_DEPTH_COC_FRAGMENT;
  material.needsUpdate = true;
}
