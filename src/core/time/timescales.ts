import { SECONDS_PER_DAY } from '../units';
import { jdToCalendar } from './julian';

/**
 * TAI - UTC from IERS Bulletin C / Leap_Second.dat
 * (https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat, checked 2026-10-04).
 * Each entry applies from jdUtc (00:00 UTC) onwards.
 */
export const LEAP_SECONDS: ReadonlyArray<{ jdUtc: number; taiMinusUtc: number }> = [
  { jdUtc: 2441317.5, taiMinusUtc: 10 }, // 1972-01-01
  { jdUtc: 2441499.5, taiMinusUtc: 11 }, // 1972-07-01
  { jdUtc: 2441683.5, taiMinusUtc: 12 }, // 1973-01-01
  { jdUtc: 2442048.5, taiMinusUtc: 13 }, // 1974-01-01
  { jdUtc: 2442413.5, taiMinusUtc: 14 }, // 1975-01-01
  { jdUtc: 2442778.5, taiMinusUtc: 15 }, // 1976-01-01
  { jdUtc: 2443144.5, taiMinusUtc: 16 }, // 1977-01-01
  { jdUtc: 2443509.5, taiMinusUtc: 17 }, // 1978-01-01
  { jdUtc: 2443874.5, taiMinusUtc: 18 }, // 1979-01-01
  { jdUtc: 2444239.5, taiMinusUtc: 19 }, // 1980-01-01
  { jdUtc: 2444786.5, taiMinusUtc: 20 }, // 1981-07-01
  { jdUtc: 2445151.5, taiMinusUtc: 21 }, // 1982-07-01
  { jdUtc: 2445516.5, taiMinusUtc: 22 }, // 1983-07-01
  { jdUtc: 2446247.5, taiMinusUtc: 23 }, // 1985-07-01
  { jdUtc: 2447161.5, taiMinusUtc: 24 }, // 1988-01-01
  { jdUtc: 2447892.5, taiMinusUtc: 25 }, // 1990-01-01
  { jdUtc: 2448257.5, taiMinusUtc: 26 }, // 1991-01-01
  { jdUtc: 2448804.5, taiMinusUtc: 27 }, // 1992-07-01
  { jdUtc: 2449169.5, taiMinusUtc: 28 }, // 1993-07-01
  { jdUtc: 2449534.5, taiMinusUtc: 29 }, // 1994-07-01
  { jdUtc: 2450083.5, taiMinusUtc: 30 }, // 1996-01-01
  { jdUtc: 2450630.5, taiMinusUtc: 31 }, // 1997-07-01
  { jdUtc: 2451179.5, taiMinusUtc: 32 }, // 1999-01-01
  { jdUtc: 2453736.5, taiMinusUtc: 33 }, // 2006-01-01
  { jdUtc: 2454832.5, taiMinusUtc: 34 }, // 2009-01-01
  { jdUtc: 2456109.5, taiMinusUtc: 35 }, // 2012-07-01
  { jdUtc: 2457204.5, taiMinusUtc: 36 }, // 2015-07-01
  { jdUtc: 2457754.5, taiMinusUtc: 37 }, // 2017-01-01
];

export const FIRST_LEAP_SECOND_JD = 2441317.5;
const TT_MINUS_TAI = 32.184;

/** TAI - UTC in seconds, or null before 1972 (UTC as we know it did not exist). */
export function taiMinusUtc(jdUtc: number): number | null {
  if (jdUtc < FIRST_LEAP_SECOND_JD) return null;
  let value = LEAP_SECONDS[0]!.taiMinusUtc;
  for (const entry of LEAP_SECONDS) {
    if (jdUtc >= entry.jdUtc) value = entry.taiMinusUtc;
    else break;
  }
  return value;
}

/** NASA convention for deltaT: y = year + (month - 0.5) / 12. */
export function decimalYear(jd: number): number {
  const c = jdToCalendar(jd);
  return c.year + (c.month - 0.5) / 12;
}

/** TT - UT in seconds. NASA GSFC, Espenak & Meeus polynomial expressions (deltatpoly2004). */
export function deltaT(y: number): number {
  if (y < -500) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 500) {
    const u = y / 100;
    return 10583.6 - 1014.41 * u + 33.78311 * u ** 2 - 5.952053 * u ** 3 - 0.1798452 * u ** 4 + 0.022174192 * u ** 5 + 0.0090316521 * u ** 6;
  }
  if (y < 1600) {
    const u = (y - 1000) / 100;
    return 1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3 - 0.8503463 * u ** 4 - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6;
  }
  if (y < 1700) {
    const t = y - 1600;
    return 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
  }
  if (y < 1800) {
    const t = y - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  }
  if (y < 1860) {
    const t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (y < 1900) {
    const t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    const t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  if (y < 2150) {
    return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/** TT - UTC in seconds (TT - UT via deltaT before 1972). */
export function ttMinusUtc(jdUtc: number): number {
  const tai = taiMinusUtc(jdUtc);
  return tai === null ? deltaT(decimalYear(jdUtc)) : tai + TT_MINUS_TAI;
}

/** UTC (or UT before 1972) -> TDB. TDB is taken equal to TT (|TDB - TT| < 2 ms). */
export function utcToTdb(jdUtc: number): number {
  return jdUtc + ttMinusUtc(jdUtc) / SECONDS_PER_DAY;
}

export function tdbToUtc(jdTdb: number): number {
  let utc = jdTdb - ttMinusUtc(jdTdb) / SECONDS_PER_DAY;
  utc = jdTdb - ttMinusUtc(utc) / SECONDS_PER_DAY;
  return utc;
}
