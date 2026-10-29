import { describe, expect, it } from 'vitest';
import { moonPhase } from './phase';

const SUN = [0, 0, 0] as const;
const EARTH = [1.496e8, 0, 0] as const;
const at = (deg: number, r = 384400) => [EARTH[0] + r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180), 0] as const;

describe('moonPhase', () => {
  it('is full when the Moon is opposite the Sun', () => {
    const p = moonPhase(SUN, EARTH, at(0));
    expect(p.illuminatedFraction).toBeCloseTo(1, 6);
    expect(p.name).toBe('Full Moon');
  });
  it('is new when the Moon is between Earth and the Sun', () => {
    const p = moonPhase(SUN, EARTH, at(180));
    expect(p.illuminatedFraction).toBeCloseTo(0, 6);
    expect(p.name).toBe('New Moon');
  });
  it('is half lit at a quarter, waxing when the Moon is 90 degrees east of the Sun', () => {
    // Seen from Earth the Sun lies along -x (longitude 180 deg); 90 deg east of it is longitude 270 deg.
    const first = moonPhase(SUN, EARTH, at(270));
    expect(first.illuminatedFraction).toBeCloseTo(0.5, 2);
    expect(first.waxing).toBe(true);
    expect(first.name).toBe('First quarter');
    const last = moonPhase(SUN, EARTH, at(90));
    expect(last.waxing).toBe(false);
    expect(last.name).toBe('Last quarter');
  });
  it('names crescents and gibbous phases by direction', () => {
    expect(moonPhase(SUN, EARTH, at(225)).name).toBe('Waxing crescent');
    expect(moonPhase(SUN, EARTH, at(315)).name).toBe('Waxing gibbous');
    expect(moonPhase(SUN, EARTH, at(45)).name).toBe('Waning gibbous');
    expect(moonPhase(SUN, EARTH, at(135)).name).toBe('Waning crescent');
  });
});
