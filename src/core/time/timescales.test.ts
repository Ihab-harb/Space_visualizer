import { describe, expect, it } from 'vitest';
import { deltaT, LEAP_SECONDS, taiMinusUtc, tdbToUtc, ttMinusUtc, utcToTdb } from './timescales';

describe('leap seconds (IERS)', () => {
  it('has 28 entries ending at 37 s on 2017-01-01', () => {
    expect(LEAP_SECONDS).toHaveLength(28);
    expect(LEAP_SECONDS.at(-1)).toEqual({ jdUtc: 2457754.5, taiMinusUtc: 37 });
  });
  it('steps exactly at the leap second', () => {
    expect(taiMinusUtc(2457754.5)).toBe(37);
    expect(taiMinusUtc(2457754.4999)).toBe(36);
    expect(taiMinusUtc(2441317.5)).toBe(10);
    expect(taiMinusUtc(2441317.4)).toBeNull();
  });
});

describe('deltaT (NASA, Espenak & Meeus)', () => {
  it.each([
    [1800, 13.72],
    [1900, -2.79],
    [1950, 29.07],
    [2000, 63.86],
  ])('year %d -> %d s', (year, expected) => {
    expect(deltaT(year)).toBeCloseTo(expected, 2);
  });
  it('is continuous at 2150', () => {
    expect(deltaT(2149.999)).toBeCloseTo(deltaT(2150), 1);
  });
  it('stays finite far from the present', () => {
    expect(Number.isFinite(deltaT(-5000))).toBe(true);
    expect(Number.isFinite(deltaT(10000))).toBe(true);
  });
});

describe('UTC <-> TDB', () => {
  it('adds 32.184 s + TAI-UTC after 1972', () => {
    expect(ttMinusUtc(2461317.5)).toBeCloseTo(69.184, 9);
    expect(utcToTdb(2451545.0)).toBeCloseTo(2451545.0 + 64.184 / 86400, 10);
  });
  it('uses deltaT before 1972', () => {
    expect(ttMinusUtc(2415020.5)).toBeCloseTo(deltaT(1900 + 0.5 / 12), 6);
  });
  it.each([2415020.5, 2451545.0, 2457754.6, 2461317.5, 1356001.0])('round-trips %d', (jdUtc) => {
    expect(tdbToUtc(utcToTdb(jdUtc))).toBeCloseTo(jdUtc, 9);
  });
});
