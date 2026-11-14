import { useFrame } from '@react-three/fiber';
import type { ShaderMaterial } from 'three';
import type { Body } from '../../core/catalog/schema';
import { length, sub, type Vec3 } from '../../core/math/vec3';
import { J2000_JD } from '../../core/units';
import { useFrameState } from '../FrameStateContext';
import { computeBodyFrameUniforms } from './bodyUniforms';

export function pickOccluders(bodyId: string, bodies: readonly Body[], positions: ReadonlyMap<string, Vec3>, max = 4): Array<{ id: string; posKm: Vec3; radiusKm: number }> {
  const self = positions.get(bodyId);
  if (!self) return [];
  return bodies
    .filter((b) => b.id !== bodyId && b.category !== 'star' && positions.has(b.id))
    .map((b) => ({ id: b.id, posKm: positions.get(b.id)!, radiusKm: b.shape.equatorialRadiusKm }))
    .sort((a, b) => length(sub(a.posKm, self)) - length(sub(b.posKm, self)))
    .slice(0, max);
}

/** Writes object-space lighting uniforms into the given materials every frame (after BodyMesh positions, before render). */
export function useBodyUniforms(body: Body, materials: Array<ShaderMaterial | null>, bodies: readonly Body[]): void {
  const frame = useFrameState();
  const sun = bodies.find((b) => b.category === 'star');
  useFrame((state) => {
    const pos = frame.bodyPositionsKm.get(body.id);
    const renderRadiusKm = frame.bodyRenderRadiusKm.get(body.id);
    if (!pos || !renderRadiusKm) return;
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
    });
    for (const m of materials) {
      if (!m) continue;
      const un = m.uniforms;
      un.uSunDirObj!.value.set(...u.sunDirObj);
      un.uCamObj!.value.set(...u.camObj);
      un.uSunDistTrue!.value = u.sunDistTrue;
      un.uSunRadiusTrue!.value = u.sunRadiusTrue;
      un.uOccluderCount!.value = u.occluders.length;
      u.occluders.forEach((o, i) => un.uOccluders!.value[i].set(o.posTrue[0], o.posTrue[1], o.posTrue[2], o.radiusTrue));
      un.uFlattening!.value = body.shape.polarRadiusKm / body.shape.equatorialRadiusKm;
      un.uTime!.value = state.clock.elapsedTime;
      un.uSimDays!.value = frame.jdTdb - J2000_JD;
    }
  }, -0.4);
}
