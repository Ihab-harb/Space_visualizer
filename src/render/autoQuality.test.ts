import { describe, expect, it } from 'vitest';
import { createAutoQuality, median } from './autoQuality';

/** Feed a constant frame time from t0 for durationMs; return the levels it changed to. */
function run(ctrl: ReturnType<typeof createAutoQuality>, frameMs: number, t0: number, durationMs: number): { changes: string[]; end: number } {
  const changes: string[] = [];
  let t = t0;
  while (t < t0 + durationMs) {
    t += frameMs;
    const next = ctrl.sample(frameMs, t);
    if (next) changes.push(next);
  }
  return { changes, end: t };
}

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('Auto quality (spec §5)', () => {
  it('ignores everything during the 3 s warm-up', () => {
    const c = createAutoQuality('high');
    expect(run(c, 40, 0, 2900).changes).toEqual([]);
  });
  it('steps down once the 2 s median exceeds 18 ms, then waits out the cooldown', () => {
    const c = createAutoQuality('high');
    const a = run(c, 25, 0, 5200); // first decision at ~3.0 s (warm-up over, window full)
    expect(a.changes).toEqual(['medium']);
    // Still slow, but inside the 5 s cooldown that started at ~3.0 s.
    const b = run(c, 25, a.end, 2700); // until ~7.9 s
    expect(b.changes).toEqual([]);
    const d = run(c, 25, b.end, 1000); // cooldown ends at ~8.0 s; the window refilled during it
    expect(d.changes).toEqual(['low']);
    expect(run(c, 25, d.end, 20000).changes).toEqual([]); // never below Low
  });
  it('steps up only after 10 s continuously under 12 ms', () => {
    const c = createAutoQuality('low');
    // Decisions start at ~3.0 s (warm-up); the 10 s "fast" hold therefore completes at ~13.0 s.
    const a = run(c, 8, 0, 12900);
    expect(a.changes).toEqual([]);
    const b = run(c, 8, a.end, 500);
    expect(b.changes).toEqual(['medium']);
  });
  it('holds steady between the thresholds (no oscillation)', () => {
    const c = createAutoQuality('medium');
    expect(run(c, 15, 0, 60000).changes).toEqual([]);
  });
  it('rejects single spikes and ignores tab-switch gaps', () => {
    const c = createAutoQuality('high');
    let t = 0;
    const changes: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const ms = i % 50 === 0 ? 120 : 10; // one 120 ms hitch every 50 frames
      t += ms;
      const next = c.sample(ms, t);
      if (next) changes.push(next);
    }
    const afterGap = c.sample(5000, t + 5000); // tab was hidden for 5 s
    expect(changes).toEqual([]);
    expect(afterGap).toBeNull();
    expect(c.level).toBe('high');
  });
});
