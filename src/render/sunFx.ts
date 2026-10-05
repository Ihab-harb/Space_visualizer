import { useFrame } from '@react-three/fiber';
import type { LensFlareEffect } from '@react-three/postprocessing';
import type { GodRaysEffect } from 'postprocessing';
import { useMemo, type RefObject } from 'react';
import { Vector3, type Mesh, type Vector2 } from 'three';
import type { Body } from '../core/catalog/schema';
import { length, sub, type Vec3 } from '../core/math/vec3';
import { sunVisibilityFromObserver } from '../core/shadows/eclipse';
import { useFrameState } from '../scene/FrameStateContext';
import { damp, EXPOSURE, godRayOpacity, sceneExposure, sunFrameWeight } from './exposure';

/** After body positions (-0.5) and uniforms (-0.4), before the composer. */
const SUN_FX_PRIORITY = -0.3;
/** The proxy sits just inside the drawn Sun so scene geometry in front of it occludes the rays. */
const PROXY_RADIUS_FACTOR = 0.98;
/** Off-screen NDC parking spot for the flare when the Sun is behind the camera. */
const OFFSCREEN_NDC = 10;

/**
 * Sun effects driver: god-ray proxy placement, occlusion-aware flare, and scene-driven exposure targets.
 * Always runs (even with rays/flare inactive) because exposure and star dimming depend on it.
 */
export function useSunFx(opts: {
  sun: Body | undefined;
  bodies: readonly Body[];
  proxy: Mesh;
  flare: LensFlareEffect;
  godRays: RefObject<GodRaysEffect | null>;
}): void {
  const frame = useFrameState();
  const rel = useMemo(() => new Vector3(), []);
  const view = useMemo(() => new Vector3(), []);
  const ndc = useMemo(() => new Vector3(), []);
  useFrame((state, delta) => {
    const { sun, bodies, proxy, flare, godRays } = opts;
    const sunKm = sun && frame.bodyPositionsKm.get(sun.id);
    const sunR = sun && frame.bodyRenderRadiusKm.get(sun.id);
    if (!sun || !sunKm || !sunR) return;
    const d = sub(sunKm, frame.cameraPositionKm);
    rel.set(d[0], d[1], d[2]);
    proxy.position.copy(rel);
    proxy.scale.setScalar(sunR * PROXY_RADIUS_FACTOR);
    proxy.updateMatrixWorld(true);

    const occluders: Array<{ posKm: Vec3; radiusKm: number }> = [];
    for (const b of bodies) {
      if (b.id === sun.id) continue;
      const p = frame.bodyPositionsKm.get(b.id);
      const r = frame.bodyRenderRadiusKm.get(b.id);
      if (p && r) occluders.push({ posKm: p, radiusKm: r });
    }
    const visible = sunVisibilityFromObserver(frame.cameraPositionKm, sunKm, sunR, occluders);

    state.camera.updateMatrixWorld();
    view.copy(rel).applyMatrix4(state.camera.matrixWorldInverse);
    const inFront = view.z < 0;
    if (inFront) ndc.copy(rel).project(state.camera);
    const weight = sunFrameWeight(visible, inFront ? [ndc.x, ndc.y] : null);
    const angularRadius = Math.asin(Math.min(1, sunR / Math.max(length(d), 1e-9)));
    const target = sceneExposure(weight, angularRadius);
    frame.fx.exposure = damp(frame.fx.exposure, target.exposure, EXPOSURE.damping, delta);
    frame.fx.skyDim = damp(frame.fx.skyDim, target.skyDim, EXPOSURE.damping, delta);

    const lens = flare.uniforms.get('lensPosition')!.value as Vector2;
    lens.x = inFront ? ndc.x : OFFSCREEN_NDC;
    lens.y = inFront ? ndc.y : OFFSCREEN_NDC;
    // The library's shader fades the flare with mix(flare, 0, opacity): 1 means no flare, 0 means full flare.
    flare.uniforms.get('opacity')!.value = 1 - weight;
    const res = flare.uniforms.get('screenRes')!.value as Vector2;
    res.set(state.size.width, state.size.height);
    if (godRays.current) godRays.current.blendMode.opacity.value = godRayOpacity(visible, inFront, angularRadius);
  }, SUN_FX_PRIORITY);
}