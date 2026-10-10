import type { Tier } from '../../core/catalog/schema';
import { eclipticToEquatorial } from '../../core/frames/rotation';
import type { Vec3 } from '../../core/math/vec3';

/** Star-map texture coordinate for a direction in the ecliptic J2000 frame (NASA Deep Star Maps layout). */
export function eclipticDirToSkyUv(dir: Vec3): [number, number] {
  const [x, y, z] = eclipticToEquatorial(dir);
  const ra = Math.atan2(y, x);
  const dec = Math.asin(Math.max(-1, Math.min(1, z / Math.hypot(x, y, z))));
  const u = 0.5 - ra / (2 * Math.PI);
  return [u - Math.floor(u), 0.5 + dec / Math.PI];
}

export function eclipticToEquatorialColumns(): [Vec3, Vec3, Vec3] {
  return [eclipticToEquatorial([1, 0, 0]), eclipticToEquatorial([0, 1, 0]), eclipticToEquatorial([0, 0, 1])];
}

export function skyTier(textureTier: Tier): Tier {
  if (textureTier === '8k') return '8k';
  return textureTier === '1k' ? '2k' : '4k';
}
