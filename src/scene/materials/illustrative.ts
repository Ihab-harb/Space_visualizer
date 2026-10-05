import { J2000_JD } from '../../core/units';

/** Illustrative visual constants. The UI labels these visuals illustrative; no data is derived from them. */
export const LIMB_DARKENING_U = 0.6;
/** The cloud tops circle Venus in about four Earth days (NASA Science, Venus). */
export const VENUS_CLOUD_PERIOD_DAYS = 4;
export const CORONA_SCALE = 4;

export function limbDarkening(mu: number, u = LIMB_DARKENING_U): number {
  return 1 - u * (1 - Math.min(1, Math.max(0, mu)));
}

/** Cloud-deck rotation angle relative to the surface, in [0, 2*PI). Float64 here so the shader gets a small, precise angle. */
export function venusCloudAngle(jdTdb: number): number {
  const turns = (jdTdb - J2000_JD) / VENUS_CLOUD_PERIOD_DAYS;
  return (turns - Math.floor(turns)) * 2 * Math.PI;
}

export function coronaProfile(b: number): number {
  if (b < 1) return 0;
  return 0.6 * Math.exp(-3 * (b - 1)) + 0.12 / (b * b);
}
