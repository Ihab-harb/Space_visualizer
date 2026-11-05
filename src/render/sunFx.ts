import { useFrame } from '@react-three/fiber';
import type { LensFlareEffect } from '@react-three/postprocessing';
import type { GodRaysEffect } from 'postprocessing';
import { useMemo, type RefObject } from 'react';
import { Vector3, type Mesh, type Vector2 } from 'three';
import type { Body } from '../core/catalog/schema';
import { length, sub, type Vec3 } from '../core/math/vec3';
import { sunVisibilityFromObserver } from '../core/shadows/eclipse';
import { useFrameState } from '../scene/FrameStateContext';
import { damp, EXPOSURE, flareOpacity, godRayOpacity, sceneExposure, sunFrameWeight } from './exposure';

/** Exposure floor while the Sun is explored (illustrative, Task 6). */
export const SUN_EXPLORE_EXPOSURE = 0.8;

/** How far the Sun's own Explore view is in focus (0 when another body, or nothing, is explored). */
export function sunExploreWeight(explore: { bodyId: string; focus: number } | null, sunId: string): number {
  return explore && explore.bodyId === sunId ? explore.focus : 0;
}

/** After body positions (-0.5) and uniforms (-0.4), before the composer. */
const SUN_FX_PRIORITY = -0.3;
/**
 * The proxy sits just outside the drawn Sun, so the Sun's own depth (kept by the composer's autoClear={false}) does not hide
 * it, while scene geometry in front of it still occludes the rays.
 */
export const PROXY_RADIUS_FACTOR = 1.02;
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
    // Exploring the Sun: the disc fills the frame, but the full dip would grey out its glowing zones (illustrative).
    const sunExplore = sunExploreWeight(frame.explore, sun.id);
    target.exposure += (Math.max(target.exposure, SUN_EXPLORE_EXPOSURE) - target.exposure) * sunExplore;
    frame.fx.exposure = damp(frame.fx.exposure, target.exposure, EXPOSURE.damping, delta);
    frame.fx.skyDim = damp(frame.fx.skyDim, target.skyDim, EXPOSURE.damping, delta);

    const lens = flare.uniforms.get('lensPosition')!.value as Vector2;
    lens.x = inFront ? ndc.x : OFFSCREEN_NDC;
    lens.y = inFront ? ndc.y : OFFSCREEN_NDC;
    // Exploring the Sun turns the flare and god rays off so its zones read (spec §6); they fade with the Explore focus.
    const keep = 1 - sunExploreWeight(frame.explore, sun.id);
    flare.uniforms.get('opacity')!.value = 1 - (1 - flareOpacity(weight)) * keep;
    const res = flare.uniforms.get('screenRes')!.value as Vector2;
    res.set(state.size.width, state.size.height);
    if (godRays.current) godRays.current.blendMode.opacity.value = godRayOpacity(visible, inFront, angularRadius) * keep;
  }, SUN_FX_PRIORITY);
}