import { describe, expect, it } from 'vitest';
import { calendarToJd } from './julian';
import { formatUtc, parseDateInput } from './format';

describe('formatUtc', () => {
  it('formats AD dates as UTC after 1972', () => {
    expect(formatUtc(2451545.0)).toBe('1 Jan 2000, 12:00:00 UTC');
  });
  it('labels pre-1972 times as UT and BC years', () => {
    expect(formatUtc(1356001.0)).toBe('12 Jul 1001 BC, 12:00:00 UT');
  });
  it('truncates fractional seconds', () => {
    expect(formatUtc(2451545.0 - 0.6 / 86400)).toBe('1 Jan 2000, 11:59:59 UTC');
  });
});

describe('parseDateInput', () => {
  it('accepts date and optional time', () => {
    expect(parseDateInput('2026-10-04')).toEqual({ ok: true, jdUtc: 2461317.5 });
    expect(parseDateInput(' 2026-10-04 08:40 ')).toEqual({
      ok: true,
      jdUtc: calendarToJd({ year: 2026, month: 10, day: 4, hour: 8, minute: 40, second: 0 }),
    });
    expect(parseDateInput('2026-10-04T08:40:30').ok).toBe(true);
  });
  it('accepts negative astronomical years', () => {
    expect(parseDateInput('-1000-07-12 12:00')).toEqual({ ok: true, jdUtc: 1356001.0 });
  });
  it.each([
    ['2026-02-30', 'That date does not exist in the calendar.'],
    ['1582-10-10', 'That date does not exist in the calendar.'],
    ['2026-13-01', 'That date does not exist in the calendar.'],
    ['2026-10-04 24:00', 'Time must be between 00:00:00 and 23:59:59.'],
    ['2026-10-04 12:60', 'Time must be between 00:00:00 and 23:59:59.'],
    ['-4713-01-01', 'Years from -4712 to 9999 are supported (negative = BC, 0 = 1 BC).'],
    ['10000-01-01', 'Years from -4712 to 9999 are supported (negative = BC, 0 = 1 BC).'],
    ['hello', 'Use YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]. Use negative years for BC (0 = 1 BC).'],
    ['', 'Use YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]. Use negative years for BC (0 = 1 BC).'],
  ])('rejects %s', (text, error) => {
    expect(parseDateInput(text)).toEqual({ ok: false, error });
  });
});
