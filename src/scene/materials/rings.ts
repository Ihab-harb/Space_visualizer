import type { Body } from '../../core/catalog/schema';
import type { Vec3 } from '../../core/math/vec3';
import { rayPlaneRadius } from '../../core/shadows/eclipse';

/** Ring radii in units of the planet's equatorial radius (the object-space unit of the body mesh). */
export function ringRadii(body: Body): { inner: number; outer: number } | null {
  const rings = body.imagery?.rings;
  if (!rings) return null;
  const inner = rings.innerKm.value;
  const outer = rings.outerKm.value;
  if (typeof inner !== 'number') throw new Error(`Body ${body.id}: imagery.rings.innerKm must be a number, got ${typeof inner}.`);
  if (typeof outer !== 'number') throw new Error(`Body ${body.id}: imagery.rings.outerKm must be a number, got ${typeof outer}.`);
  const eq = body.shape.equatorialRadiusKm;
  return { inner: inner / eq, outer: outer / eq };
}

/** Ring-profile coordinate (0 inner edge, 1 outer edge) where sunlight reaching `point` crossed the ring plane. */
export function ringShadowCoord(point: Vec3, sunDir: Vec3, inner: number, outer: number): number | null {
  const r = rayPlaneRadius(point, sunDir);
  if (r === null || r < inner || r > outer) return null;
  return (r - inner) / (outer - inner);
}

/** The camera sees the lit face when it is on the same side of the ring plane as the Sun. */
export function ringFaceLighting(sunDirObj: Vec3, camDirObj: Vec3): { litFace: boolean; mu0: number; mu: number } {
  return { litFace: sunDirObj[2] * camDirObj[2] >= 0, mu0: Math.abs(sunDirObj[2]), mu: Math.abs(camDirObj[2]) };
}
