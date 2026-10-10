import { parseDateInput } from '../core/time/format';
import { utcToTdb } from '../core/time/timescales';

/** JPL's high-accuracy span for the approximate planet elements (spec §5 accuracy note). */
export const TIMELINE_START_UTC = '1800-01-01';
export const TIMELINE_END_UTC = '2050-12-31';

const jd = (date: string) => {
  const p = parseDateInput(date);
  if (!p.ok) throw new Error(`bad timeline date ${date}`);
  return utcToTdb(p.jdUtc);
};
const RANGE = { start: jd(TIMELINE_START_UTC), end: jd(TIMELINE_END_UTC) };

export function timelineRangeTdb(): { start: number; end: number } {
  return RANGE;
}

export function fractionForJd(jdTdb: number): { fraction: number; outside: 'before' | 'after' | null } {
  if (jdTdb < RANGE.start) return { fraction: 0, outside: 'before' };
  if (jdTdb > RANGE.end) return { fraction: 1, outside: 'after' };
  return { fraction: (jdTdb - RANGE.start) / (RANGE.end - RANGE.start), outside: null };
}

export function jdForFraction(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return RANGE.start + f * (RANGE.end - RANGE.start);
}

export function timelineTicks(): Array<{ year: number; fraction: number }> {
  return [1800, 1850, 1900, 1950, 2000, 2050].map((year) => ({ year, fraction: fractionForJd(jd(`${year}-01-01`)).fraction }));
}
