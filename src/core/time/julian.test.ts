import { describe, expect, it } from 'vitest';
import { calendarToJd, jdToCalendar, jdToUnixMs, unixMsToJd, type CalendarDate } from './julian';

const d = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0): CalendarDate => ({
  year, month, day, hour, minute, second,
});

describe('calendarToJd', () => {
  it.each([
    [d(2000, 1, 1, 12), 2451545.0],
    [d(1957, 10, 4, 19, 26, 24), 2436116.31], // Meeus example 7.a
    [d(333, 1, 27, 12), 1842713.0], // Meeus example 7.b (Julian calendar)
    [d(1582, 10, 15), 2299160.5], // first Gregorian day
    [d(1582, 10, 4), 2299159.5], // last Julian day
    [d(-1000, 7, 12, 12), 1356001.0], // Meeus table 7
    [d(-4712, 1, 1, 12), 0.0],
    [d(1800, 1, 1), 2378496.5],
    [d(2051, 1, 1), 2470172.5],
    [d(-2999, 1, 1), 625673.5],
    [d(3001, 1, 1), 2817152.5],
  ])('%o -> %d', (date, jd) => {
    expect(calendarToJd(date)).toBeCloseTo(jd, 6);
  });
});

describe('jdToCalendar', () => {
  it('inverts known dates', () => {
    expect(jdToCalendar(2436116.31)).toEqual(d(1957, 10, 4, 19, 26, 24));
    expect(jdToCalendar(2299160.5)).toEqual(d(1582, 10, 15));
    expect(jdToCalendar(2299159.5)).toEqual(d(1582, 10, 4));
    expect(jdToCalendar(1356001.0)).toEqual(d(-1000, 7, 12, 12));
  });
  it('carries a time that rounds up to midnight into the next day (never 24:00:00)', () => {
    expect(jdToCalendar(2451544.5 - 0.0004 / 86_400)).toEqual(d(2000, 1, 1));
  });
  it('round-trips across the supported range to the millisecond', () => {
    for (let jd = 625673.5; jd < 2817152.5; jd += 7919.123456) {
      const back = calendarToJd(jdToCalendar(jd));
      expect(Math.abs(back - jd) * 86_400_000).toBeLessThan(1);
    }
  });
});

describe('unix time', () => {
  it('maps the Unix epoch to JD 2440587.5', () => {
    expect(unixMsToJd(0)).toBe(2440587.5);
    expect(jdToUnixMs(2440588.5)).toBe(86_400_000);
  });
});
