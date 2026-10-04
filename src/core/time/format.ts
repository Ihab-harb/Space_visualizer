import { calendarToJd, jdToCalendar, type CalendarDate } from './julian';
import { FIRST_LEAP_SECOND_JD } from './timescales';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "4 Oct 2026, 08:40:40 UTC"; BC years as "1001 BC"; "UT" before 1972. */
export function formatUtc(jdUtc: number): string {
  const c = jdToCalendar(jdUtc);
  const year = c.year > 0 ? String(c.year) : `${1 - c.year} BC`;
  const scale = jdUtc >= FIRST_LEAP_SECOND_JD ? 'UTC' : 'UT';
  return `${c.day} ${MONTHS[c.month - 1]} ${year}, ${pad(c.hour)}:${pad(c.minute)}:${pad(Math.floor(c.second))} ${scale}`;
}

export type DateParseResult = { ok: true; jdUtc: number } | { ok: false; error: string };

/** Meeus' calendar algorithms are valid for JD >= 0 (-4712-01-01); 9999 keeps four-digit years. */
export const MIN_YEAR = -4712;
export const MAX_YEAR = 9999;
const FORMAT_ERROR = 'Use YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]. Use negative years for BC (0 = 1 BC).';
const PATTERN = /^\s*(-?\d{1,6})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?)?\s*$/;

export function parseDateInput(text: string): DateParseResult {
  const m = PATTERN.exec(text);
  if (!m) return { ok: false, error: FORMAT_ERROR };
  const date: CalendarDate = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] === undefined ? 0 : Number(m[4]),
    minute: m[5] === undefined ? 0 : Number(m[5]),
    second: m[6] === undefined ? 0 : Number(m[6]),
  };
  if (date.year < MIN_YEAR || date.year > MAX_YEAR) {
    return { ok: false, error: `Years from ${MIN_YEAR} to ${MAX_YEAR} are supported (negative = BC, 0 = 1 BC).` };
  }
  if (date.hour > 23 || date.minute > 59 || date.second >= 60) {
    return { ok: false, error: 'Time must be between 00:00:00 and 23:59:59.' };
  }
  if (date.month < 1 || date.month > 12 || date.day < 1) {
    return { ok: false, error: 'That date does not exist in the calendar.' };
  }
  const midnight = calendarToJd({ ...date, hour: 0, minute: 0, second: 0 });
  const back = jdToCalendar(midnight);
  if (back.year !== date.year || back.month !== date.month || back.day !== date.day) {
    return { ok: false, error: 'That date does not exist in the calendar.' };
  }
  return { ok: true, jdUtc: calendarToJd(date) };
}
