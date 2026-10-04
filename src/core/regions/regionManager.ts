import type { Region } from '../catalog/schema';
import { add, length, sub, type Vec3 } from '../math/vec3';

/** Width (in powers of ten of distance) over which a region fades at each edge of its active range. */
export const FADE_BAND_DEX = 0.3;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function regionOpacity(region: Region, cameraDistanceKm: number): number {
  const [min, max] = region.activeRangeKm;
  const logD = Math.log10(Math.max(cameraDistanceKm, Number.MIN_VALUE));
  const upper = clamp01((Math.log10(max) - logD) / FADE_BAND_DEX);
  const lower = min <= 0 ? 1 : clamp01((logD - Math.log10(min)) / FADE_BAND_DEX);
  return Math.min(upper, lower);
}

export function regionOriginInRootKm(region: Region, byId: ReadonlyMap<string, Region>): Vec3 {
  let origin = region.originInParentKm;
  let parentId = region.parentId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) throw new Error(`Region "${region.id}" has unknown parent "${parentId}"`);
    origin = add(origin, parent.originInParentKm);
    parentId = parent.parentId;
  }
  return origin;
}

export function regionVisibility(regions: readonly Region[], cameraPositionKm: Vec3): Map<string, number> {
  const byId = new Map(regions.map((r) => [r.id, r]));
  return new Map(regions.map((r) => [r.id, regionOpacity(r, length(sub(cameraPositionKm, regionOriginInRootKm(r, byId))))]));
}
