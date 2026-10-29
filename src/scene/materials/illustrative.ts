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

// Moon look constants (M2b.2 spec §5.3, my call; illustrative). The drawer lists each note in the Moon's Imagery section.
/**
 * Earthshine on the Moon's night side: sunlight reflected by Earth's day side. `max` is the strength (in units of full
 * sunlight) when Earth's whole day side faces the Moon (new Moon); it scales with Earth's lit fraction seen from the Moon.
 * The real ratio is near 1e-4; this is raised so the night side reads on screen.
 */
export const EARTHSHINE = {
  max: 0.02,
  color: [0.62, 0.72, 0.9] as const,
  note: "Earthshine on the Moon's night side is illustrative: its strength follows how much of Earth's day side faces the Moon.",
};

/**
 * Light inside the shadow of a body with an atmosphere (a lunar eclipse): the remaining light is mixed toward `color` by
 * `amount × (1 − visible fraction)`, and never falls below `floor` (sunlight bent into the umbra by the atmosphere).
 * `centreDarkening` dims that floor toward the umbra's axis (at the axis it is floor × (1 − centreDarkening)).
 */
export const ECLIPSE_TINT = {
  color: [1.0, 0.3, 0.08] as const,
  amount: 0.9,
  floor: 0.12,
  centreDarkening: 0.5,
  note: "Eclipse colour is illustrative: inside Earth's shadow the Moon turns a dim copper red. The shadow's size and timing are real.",
};

/** Bodies that get earthshine: Earth's own moons. */
export function receivesEarthshine(body: { category: string; parentId: string | null }): boolean {
  return body.category === 'moon' && body.parentId === 'earth';
}
