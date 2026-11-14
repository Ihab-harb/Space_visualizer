import { J2000_JD } from '../../core/units';

/** Illustrative visual constants. The UI labels these visuals illustrative; no data is derived from them. */
export const LIMB_DARKENING_U = 0.6;
/** The cloud tops circle Venus in about four Earth days (NASA Science, Venus). */
export const VENUS_CLOUD_PERIOD_DAYS = 4;
export const CORONA_SCALE = 4;
/** Corona glow: A * exp(-K * (b - 1)) + C / b^2, faded to exactly 0 between CORONA_FADE_START and CORONA_SCALE. */
export const CORONA_A = 0.6;
export const CORONA_K = 3;
export const CORONA_C = 0.12;
export const CORONA_FADE_START = 2;
/** Sun granulation (illustrative): fine cells, a faint close-zoom octave and a broad supergranulation modulation. */
export const GRAN_FREQ = 40;
export const GRAN_AMP = 0.26;
export const GRAN_FINE_FREQ = 140;
export const GRAN_FINE_AMP = 0.03;
export const SUPERGRAN_FREQ = 12;
export const SUPERGRAN_AMP = 0.08;

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
  const t = Math.min(1, Math.max(0, (b - CORONA_FADE_START) / (CORONA_SCALE - CORONA_FADE_START)));
  const window = 1 - t * t * (3 - 2 * t);
  return (CORONA_A * Math.exp(-CORONA_K * (b - 1)) + CORONA_C / (b * b)) * window;
}

/** Strength of the cinematic fill light (spec §5), applied only while Camera effects is on. */
export const CINEMATIC_FILL = 0.4;

// Look constants tuned in M2a.2 Task 9 (illustrative; no data meaning; Decision 0007 records start and final values).
/** Unlit ring face brightness relative to the diffuse-transmission model. */
export const RING_UNLIT_SCALE = 0.3;
/** Earth ocean Sun glint: GGX strength and roughness. */
export const GLINT_STRENGTH = 0.035;
export const GLINT_ROUGHNESS = 0.45;
/** Earth cloud-shadow offset toward the Sun, in v units (u is halved for the equirectangular map and divided by cos(latitude)). */
export const CLOUD_SHADOW_OFFSET = 0.004;
/** Fraction of direct sunlight a full cloud blocks on the ground below its shadow. */
export const CLOUD_SHADOW_DARKNESS = 0.8;
/** Corona colour multiplier on the Sun display colour. */
export const CORONA_GAIN = 0.9;
