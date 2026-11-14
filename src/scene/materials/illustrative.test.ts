import { describe, expect, it } from 'vitest';
import { J2000_JD } from '../../core/units';
import { makeEarth, makeMoon } from '../../test/fixtures';
import { illustrativeNotes } from '../../ui/imagery';
import { CORONA_SCALE, coronaProfile, EARTHSHINE, ECLIPSE_TINT, LIMB_DARKENING_U, limbDarkening, receivesEarthshine, venusCloudAngle } from './illustrative';

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
  it('fades the corona to exactly zero at the shell edge, smoothly and monotonically', () => {
    expect(coronaProfile(CORONA_SCALE)).toBe(0);
    expect(coronaProfile(CORONA_SCALE - 0.01)).toBeGreaterThan(0);
    expect(coronaProfile(CORONA_SCALE - 0.01)).toBeLessThan(1e-4);
    let prev = coronaProfile(1);
    for (let b = 1.01; b <= CORONA_SCALE; b += 0.01) {
      const v = coronaProfile(b);
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      prev = v;
    }
  });
});

describe('Moon look constants (illustrative, M2b.2)', () => {
  const moon = makeMoon();
  const earth = makeEarth();

  it('keeps earthshine faint and the eclipse tint inside sensible bounds', () => {
    expect(EARTHSHINE.max).toBeGreaterThan(0);
    expect(EARTHSHINE.max).toBeLessThan(0.2);
    expect(ECLIPSE_TINT.amount).toBeGreaterThan(0);
    expect(ECLIPSE_TINT.amount).toBeLessThanOrEqual(1);
    expect(ECLIPSE_TINT.floor).toBeGreaterThan(0);
    expect(ECLIPSE_TINT.floor).toBeLessThan(0.2);
    expect(ECLIPSE_TINT.centreDarkening).toBeGreaterThanOrEqual(0);
    expect(ECLIPSE_TINT.centreDarkening).toBeLessThan(1);
  });
  it('lists earthshine and the eclipse tint in the drawer’s illustrative notes for the Moon', () => {
    const notes = illustrativeNotes(moon, { parent: earth });
    expect(notes).toContain(EARTHSHINE.note);
    expect(notes).toContain(ECLIPSE_TINT.note);
  });
  it('adds neither note to Earth itself', () => {
    const notes = illustrativeNotes(earth);
    expect(notes).not.toContain(EARTHSHINE.note);
    expect(notes).not.toContain(ECLIPSE_TINT.note);
  });
  it('lights only Earth’s own moons with earthshine', () => {
    expect(receivesEarthshine(moon)).toBe(true);
    expect(receivesEarthshine(earth)).toBe(false);
    expect(receivesEarthshine({ ...moon, parentId: 'mars' })).toBe(false);
  });
});
