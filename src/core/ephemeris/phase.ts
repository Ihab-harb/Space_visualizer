import { angleBetween, sub, type Vec3 } from '../math/vec3';

export type PhaseName =
  | 'New Moon'
  | 'Waxing crescent'
  | 'First quarter'
  | 'Waxing gibbous'
  | 'Full Moon'
  | 'Waning gibbous'
  | 'Last quarter'
  | 'Waning crescent';

export interface MoonPhase {
  /** Share of the Moon's disc that is lit as seen from Earth, 0 to 1. */
  illuminatedFraction: number;
  waxing: boolean;
  name: PhaseName;
}

/**
 * The Moon's phase from three positions in one ecliptic frame. The lit fraction is (1 + cos i) / 2, where i is the angle
 * at the Moon between the directions to the Sun and to Earth. It is waxing when the Moon's ecliptic longitude is 0 to 180
 * degrees east of the Sun's, both seen from Earth.
 */
export function moonPhase(sunKm: Vec3, earthKm: Vec3, moonKm: Vec3): MoonPhase {
  const i = angleBetween(sub(sunKm, moonKm), sub(earthKm, moonKm));
  const illuminatedFraction = (1 + Math.cos(i)) / 2;
  const lonOf = (p: Vec3) => {
    const d = sub(p, earthKm);
    return Math.atan2(d[1], d[0]);
  };
  const TWO_PI = 2 * Math.PI;
  const elongation = (((lonOf(moonKm) - lonOf(sunKm)) % TWO_PI) + TWO_PI) % TWO_PI;
  const waxing = elongation > 0 && elongation < Math.PI;
  const f = illuminatedFraction;
  let name: PhaseName;
  if (f < 0.01) name = 'New Moon';
  else if (f > 0.99) name = 'Full Moon';
  else if (Math.abs(f - 0.5) <= 0.02) name = waxing ? 'First quarter' : 'Last quarter';
  else if (f < 0.5) name = waxing ? 'Waxing crescent' : 'Waning crescent';
  else name = waxing ? 'Waxing gibbous' : 'Waning gibbous';
  return { illuminatedFraction, waxing, name };
}
