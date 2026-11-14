import { describe, expect, it } from 'vitest';
import { fractionForJd, jdForFraction, timelineRangeTdb, timelineTicks } from './timeline';

describe('timeline (JPL high-accuracy span 1800–2050)', () => {
  const { start, end } = timelineRangeTdb();
  it('maps the ends and round-trips', () => {
    expect(fractionForJd(start)).toEqual({ fraction: 0, outside: null });
    expect(fractionForJd(end).fraction).toBeCloseTo(1, 12);
    const mid = (start + end) / 2;
    expect(jdForFraction(fractionForJd(mid).fraction)).toBeCloseTo(mid, 6);
  });
  it('clamps and flags dates outside the span', () => {
    expect(fractionForJd(start - 1000)).toEqual({ fraction: 0, outside: 'before' });
    expect(fractionForJd(end + 1000)).toEqual({ fraction: 1, outside: 'after' });
  });
  it('labels every 50 years', () => {
    expect(timelineTicks().map((t) => t.year)).toEqual([1800, 1850, 1900, 1950, 2000, 2050]);
    expect(timelineTicks()[0]!.fraction).toBe(0);
  });
});
