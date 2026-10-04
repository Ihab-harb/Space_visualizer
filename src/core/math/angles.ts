export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const ARCSEC = DEG / 3600;

/** Normalize to [0, 360). */
export function normalizeDeg360(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r + 0; // "+ 0" turns -0 into 0
}

/** Normalize to (-180, 180]. */
export function normalizeDeg180(deg: number): number {
  const r = normalizeDeg360(deg);
  return r > 180 ? r - 360 : r;
}

/** Normalize to [-pi, pi]. */
export function normalizeRadPi(rad: number): number {
  const twoPi = 2 * Math.PI;
  let r = rad % twoPi;
  if (r > Math.PI) r -= twoPi;
  else if (r < -Math.PI) r += twoPi;
  return r;
}
