import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { ShaderMaterial } from 'three';
import type { Body } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import { surfaceDirection } from '../../core/frames/surfacePoint';
import { add, length, scale, sub, type Vec3 } from '../../core/math/vec3';
import { J2000_JD } from '../../core/units';
import { useFrameState } from '../FrameStateContext';
import { useRenderStore } from '../../state/renderStore';
import { computeBodyFrameUniforms } from './bodyUniforms';
import { advanceSpot, CINEMATIC_FILL, receivesEarthshine } from './illustrative';
import { useDetailsStore } from '../../state/detailsStore';
import { useExploreStore } from '../../state/exploreStore';
import { featureEntry } from '../../ui/explore/featureModel';
import { NO_CLIP } from './createBodyMaterial';
import { exploreShellUniforms } from '../interior/exploreFrame';

/** The nearest `max` non-star bodies, nearest first (true radii; `atmosphere` drives the eclipse tint). */
export function pickOccluders(bodyId: string, bodies: readonly Body[], positions: ReadonlyMap<string, Vec3>, max = 4): Array<{ id: string; posKm: Vec3; radiusKm: number; atmosphere: boolean }> {
  const self = positions.get(bodyId);
  if (!self) return [];
  return bodies
    .filter((b) => b.id !== bodyId && b.category !== 'star' && positions.has(b.id))
    .map((b) => ({ id: b.id, posKm: positions.get(b.id)!, radiusKm: b.shape.equatorialRadiusKm, atmosphere: b.render.atmosphere !== null }))
    .sort((a, b) => length(sub(a.posKm, self)) - length(sub(b.posKm, self)))
    .slice(0, max);
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * The feature the feature light should fall on: the selected feature of the explored body, on the Surface tab, once its
 * details are ready. Null otherwise (another body, the Interior tab, nothing selected, an unknown id).
 */
export function spotFeature(bodyId: string, explore: { active: boolean; bodyId: string | null; view: string; selectedFeatureId: string | null }, details: BodyDetails | null): { id: string; dir: Vec3 } | null {
  if (!explore.active || explore.bodyId !== bodyId || explore.view !== 'whole' || !explore.selectedFeatureId || !details) return null;
  const f = featureEntry(details, explore.selectedFeatureId);
  return f ? { id: f.id, dir: surfaceDirection(f.latDeg, f.lonDegE) } : null;
}

/** Writes object-space lighting uniforms into the given materials every frame (after BodyMesh positions, before render). */
export function useBodyUniforms(body: Body, materials: Array<ShaderMaterial | null>, bodies: readonly Body[]): void {
  const frame = useFrameState();
  const sun = bodies.find((b) => b.category === 'star');
  const earthshineFrom = receivesEarthshine(body) ? body.parentId : null;
  // Feature light: the last feature lit (kept so the light fades out where it was) and its strength.
  const spot = useRef<{ id: string | null; dir: Vec3; strength: number }>({ id: null, dir: [0, 0, 1], strength: 0 });
  useFrame((state, delta) => {
    const ex = useExploreStore.getState();
    const sp = spot.current;
    let spotOn = false;
    if (ex.active && ex.bodyId === body.id && ex.view === 'whole' && ex.selectedFeatureId) {
      // Looked up when the selection changes (and each frame only while the details are still loading), not every frame.
      if (sp.id !== ex.selectedFeatureId) {
        const entry = useDetailsStore.getState().entries[body.id];
        const target = spotFeature(body.id, ex, entry?.status === 'ready' ? entry.details : null);
        if (target) {
          sp.id = target.id;
          sp.dir = target.dir;
        }
      }
      spotOn = sp.id === ex.selectedFeatureId;
    }
    if (spotOn || sp.strength > 0) sp.strength = advanceSpot(sp.strength, spotOn, delta, prefersReducedMotion());
    if (!spotOn && sp.strength === 0) sp.id = null;
    const centre = frame.bodyPositionsKm.get(body.id);
    const renderRadiusKm = frame.bodyRenderRadiusKm.get(body.id);
    if (!centre || !renderRadiusKm) return;
    // Explore: the explored body's outer shell is cut and may be lifted (shade it where it is drawn); other bodies dim.
    const shell = exploreShellUniforms(frame.explore, body.id);
    const pos = shell.liftRadii ? add(centre, scale(frame.explore!.upWorld, shell.liftRadii * renderRadiusKm)) : centre;
    const sunPos = (sun && frame.bodyPositionsKm.get(sun.id)) ?? ([0, 0, 0] as Vec3);
    const u = computeBodyFrameUniforms({
      bodyPosKm: pos,
      cameraPosKm: frame.cameraPositionKm,
      sunPosKm: sunPos,
      orientation: frame.bodyOrientation.get(body.id),
      renderRadiusKm,
      trueRadiusKm: body.shape.equatorialRadiusKm,
      sunRadiusKm: sun?.shape.equatorialRadiusKm ?? 695700,
      occluders: body.category === 'star' ? [] : pickOccluders(body.id, bodies, frame.bodyPositionsKm),
      ...(earthshineFrom && frame.bodyPositionsKm.has(earthshineFrom) ? { earthPosKm: frame.bodyPositionsKm.get(earthshineFrom)! } : {}),
    });
    const effects = useRenderStore.getState().effects;
    for (const m of materials) {
      if (!m) continue;
      const un = m.uniforms;
      un.uSunDirObj!.value.set(...u.sunDirObj);
      un.uCamObj!.value.set(...u.camObj);
      un.uSunDistTrue!.value = u.sunDistTrue;
      un.uSunRadiusTrue!.value = u.sunRadiusTrue;
      un.uOccluderCount!.value = u.occluders.length;
      u.occluders.forEach((o, i) => {
        un.uOccluders!.value[i].set(o.posTrue[0], o.posTrue[1], o.posTrue[2], o.radiusTrue);
        un.uOccluderAtmo!.value.setComponent(i, o.atmosphere ? 1 : 0);
      });
      un.uEarthshine!.value = u.earthshine?.strength ?? 0;
      if (u.earthshine) un.uEarthshineDir!.value.set(...u.earthshine.dirObj);
      un.uFlattening!.value = body.shape.polarRadiusKm / body.shape.equatorialRadiusKm;
      un.uFill!.value = effects ? CINEMATIC_FILL : 0;
      un.uTime!.value = state.clock.elapsedTime;
      un.uSimDays!.value = frame.jdTdb - J2000_JD;
      if (un.uClip) {
        if (shell.clip) un.uClip.value.set(shell.clip[0], shell.clip[1], shell.clip[2], shell.clip[3]);
        else un.uClip.value.w = NO_CLIP;
      }
      if (un.uDim) un.uDim.value = shell.dim;
      if (un.uSpot) un.uSpot.value.set(sp.dir[0], sp.dir[1], sp.dir[2], sp.strength);
    }
  }, -0.4);
}
