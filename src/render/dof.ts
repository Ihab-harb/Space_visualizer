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

export interface CocMaterialLike {
  fragmentShader: string;
  needsUpdate: boolean;
  defines: Record<string, unknown>;
  uniforms: Record<string, unknown>;
}

const REQUIRED_UNIFORMS = ['depthBuffer', 'projectionMatrixInverse', 'cameraFar', 'focusDistance', 'focusRange'] as const;

/**
 * Installs the log-depth shader. Returns 'pending' until the library has set LOG_DEPTH (it does so when the composer
 * initialises the effect), 'failed' (after a console.error, material left untouched) if the library's assumptions that
 * this shader depends on no longer hold, and 'patched' once installed. Never throws: it runs inside the render loop.
 */
export function patchCocForLogDepth(material: CocMaterialLike): 'patched' | 'pending' | 'failed' {
  if (material.fragmentShader === LOG_DEPTH_COC_FRAGMENT) return 'patched';
  const problems: string[] = [];
  if (material.defines.PERSPECTIVE_CAMERA === undefined) problems.push('PERSPECTIVE_CAMERA define missing');
  if (material.defines.USE_REVERSED_DEPTH_BUFFER !== undefined) problems.push('USE_REVERSED_DEPTH_BUFFER is defined');
  for (const name of REQUIRED_UNIFORMS) if (!(name in material.uniforms)) problems.push(`uniform ${name} missing`);
  if (problems.length) {
    console.error(
      `Depth of field: the circle-of-confusion material no longer matches the log-depth shader (${problems.join('; ')}); leaving the stock shader, which is wrong for this scene's depth buffer.`,
    );
    return 'failed';
  }
  if (material.defines.LOG_DEPTH === undefined) return 'pending';
  material.fragmentShader = LOG_DEPTH_COC_FRAGMENT;
  material.needsUpdate = true;
  return 'patched';
}
