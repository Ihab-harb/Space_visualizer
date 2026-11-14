export interface CalendarDate {
  /** Astronomical year numbering: 0 = 1 BC, -1 = 2 BC. */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const FIRST_GREGORIAN_DAY_NUMBER = 2299161; // floor(JD + 0.5) of 1582-10-15
const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;

function isGregorian(year: number, month: number, day: number): boolean {
  if (year !== 1582) return year > 1582;
  if (month !== 10) return month > 10;
  return day >= 15;
}

/** Meeus ch. 7. Julian calendar before 1582-10-15, Gregorian after (JPL Horizons "mixed" mode). */
export function calendarToJd(date: CalendarDate): number {
  let y = date.year;
  let m = date.month;
  const dayWithFraction = date.day + (date.hour + (date.minute + date.second / 60) / 60) / 24;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  let b = 0;
  if (isGregorian(date.year, date.month, date.day)) {
    const a = Math.floor(y / 100);
    b = 2 - a + Math.floor(a / 4);
  }
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayWithFraction + b - 1524.5;
}

/** Meeus ch. 7 inverse; the time of day is rounded to the nearest millisecond. */
export function jdToCalendar(jd: number): CalendarDate {
  let z = Math.floor(jd + 0.5);
  let ms = Math.round((jd + 0.5 - z) * MS_PER_DAY);
  if (ms >= MS_PER_DAY) {
    z += 1;
    ms -= MS_PER_DAY;
  }
  let a = z;
  if (z >= FIRST_GREGORIAN_DAY_NUMBER) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const dd = Math.floor(365.25 * c);
  const e = Math.floor((b - dd) / 30.6001);
  const day = b - dd - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return {
    year,
    month,
    day,
    hour: Math.floor(ms / 3_600_000),
    minute: Math.floor((ms % 3_600_000) / 60_000),
    second: (ms % 60_000) / 1000,
  };
}

export function unixMsToJd(ms: number): number {
  return ms / MS_PER_DAY + UNIX_EPOCH_JD;
}

export function jdToUnixMs(jd: number): number {
  return (jd - UNIX_EPOCH_JD) * MS_PER_DAY;
}
