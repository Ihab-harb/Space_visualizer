import { describe, expect, it } from 'vitest';
import {
  AU_KM,
  DAYS_PER_JULIAN_CENTURY,
  J2000_JD,
  OBLIQUITY_J2000_DEG,
  SECONDS_PER_DAY,
  SPEED_OF_LIGHT_KM_S,
} from './units';

describe('units', () => {
  it('uses the IAU 2012 astronomical unit', () => {
    expect(AU_KM).toBe(149_597_870.7);
  });
  it('uses the SI speed of light', () => {
    expect(SPEED_OF_LIGHT_KM_S).toBe(299_792.458);
  });
  it('defines J2000, the Julian century and the day', () => {
    expect(J2000_JD).toBe(2_451_545.0);
    expect(DAYS_PER_JULIAN_CENTURY).toBe(36_525);
    expect(SECONDS_PER_DAY).toBe(86_400);
  });
  it('uses the IAU 1976 J2000 obliquity used by JPL Horizons ecliptic frames', () => {
    expect(OBLIQUITY_J2000_DEG).toBeCloseTo(23.4392911, 7);
  });
});
