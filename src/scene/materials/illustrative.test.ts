import { describe, expect, it } from 'vitest';
import { J2000_JD } from '../../core/units';
import { coronaProfile, LIMB_DARKENING_U, limbDarkening, venusCloudAngle } from './illustrative';

describe('illustrative profiles', () => {
  it('darkens the solar limb linearly', () => {
    expect(limbDarkening(1)).toBe(1);
    expect(limbDarkening(0)).toBeCloseTo(1 - LIMB_DARKENING_U, 12);
    expect(limbDarkening(-0.5)).toBeCloseTo(1 - LIMB_DARKENING_U, 12);
  });
  it('turns the Venus cloud deck once every four days, staying precise far from J2000', () => {
    expect(venusCloudAngle(J2000_JD)).toBeCloseTo(0, 12);
    expect(venusCloudAngle(J2000_JD + 1)).toBeCloseTo(Math.PI / 2, 12);
    expect(venusCloudAngle(J2000_JD + 4 * 25_000 + 2)).toBeCloseTo(Math.PI, 9);
    expect(venusCloudAngle(J2000_JD - 1)).toBeCloseTo(1.5 * Math.PI, 12);
  });
  it('fades the corona outward and hides it behind the disc', () => {
    expect(coronaProfile(0.5)).toBe(0);
    expect(coronaProfile(1)).toBeGreaterThan(coronaProfile(1.5));
    expect(coronaProfile(1.5)).toBeGreaterThan(coronaProfile(3));
    expect(coronaProfile(3)).toBeGreaterThan(0);
  });
});
