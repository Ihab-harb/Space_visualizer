import { describe, expect, it } from 'vitest';
import { createAutoQuality, median, resyncAuto } from './autoQuality';

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
    const a = run(c, 25, 0, 5200); // first decision at ~5.0 s (the cooldown starts at the first sample and outlasts the 3 s warm-up)
    expect(a.changes).toEqual(['medium']);
    // Still slow, but inside the 5 s cooldown that started at ~5.0 s.
    const b = run(c, 25, a.end, 4700); // until ~9.9 s
    expect(b.changes).toEqual([]);
    const d = run(c, 25, b.end, 1000); // cooldown ends at ~10.0 s; the window refilled during it
    expect(d.changes).toEqual(['low']);
    expect(run(c, 25, d.end, 20000).changes).toEqual([]); // never below Low
  });
  it('steps up only after 10 s continuously under 12 ms', () => {
    const c = createAutoQuality('low');
    // Decisions start at ~5.0 s (start-up cooldown); the 10 s "fast" hold therefore completes at ~15.0 s.
    const a = run(c, 8, 0, 14900);
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

/** Feed frames whose time depends on the controller's current level; return the changes with their times. */
function simulate(ctrl: ReturnType<typeof createAutoQuality>, frameMsAt: (level: string) => number, durationMs: number) {
  const changes: Array<{ to: string; t: number }> = [];
  let t = 0;
  while (t < durationMs) {
    const ms = frameMsAt(ctrl.level);
    t += ms;
    const next = ctrl.sample(ms, t);
    if (next) changes.push({ to: next, t });
  }
  return changes;
}

describe('Auto quality: sustained long frames (C1)', () => {
  it('drops straight to Low within 7 s when every frame takes 400 ms, once the start-up cooldown is over (ignores the warm-up)', () => {
    const c = createAutoQuality('high');
    const changes = simulate(c, () => 400, 10000);
    expect(changes.map((x) => x.to)).toEqual(['low']);
    expect(changes[0]!.t).toBeLessThanOrEqual(7000);
  });
  it('drops to Low on a 1 fps renderer (SwiftShader-like) too', () => {
    const c = createAutoQuality('high');
    const changes = simulate(c, () => 1000, 10000);
    expect(changes.map((x) => x.to)).toEqual(['low']);
    expect(changes[0]!.t).toBeLessThanOrEqual(7000);
  });
  it('ignores one isolated 5 s gap', () => {
    const c = createAutoQuality('high');
    const a = run(c, 10, 0, 4000);
    expect(c.sample(5000, a.end + 5000)).toBeNull();
    expect(run(c, 10, a.end + 5000, 3000).changes).toEqual([]);
    expect(c.level).toBe('high');
  });
  it('ignores a long pause followed by a single hitch', () => {
    const c = createAutoQuality('high');
    const a = run(c, 10, 0, 4000);
    expect(c.sample(5000, a.end + 5000)).toBeNull();
    expect(c.sample(300, a.end + 5300)).toBeNull();
    expect(run(c, 10, a.end + 5300, 3000).changes).toEqual([]);
    expect(c.level).toBe('high');
  });
  it('never counts frames while the page is not visible', () => {
    const c = createAutoQuality('high');
    let t = 0;
    for (let i = 0; i < 50; i++) {
      t += 400;
      expect(c.sample(400, t, false)).toBeNull();
    }
    expect(c.level).toBe('high');
  });
  it('waits out the cooldown after a change before acting on long frames (compile hitches after a rebuild)', () => {
    const c = createAutoQuality('high');
    const a = run(c, 25, 0, 5100);
    expect(a.changes).toEqual(['medium']);
    // Three 400 ms frames straight after the change (shader compilation) do not drop it further.
    let t = a.end;
    for (let i = 0; i < 3; i++) expect(c.sample(400, (t += 400))).toBeNull();
    expect(run(c, 15, t, 10000).changes).toEqual([]);
    expect(c.level).toBe('medium');
  });
});

describe('Auto quality: back-off and gaps (I2)', () => {
  it('settles after at most one up/down when the next level up is over 18 ms', () => {
    const c = createAutoQuality('medium');
    // 120 Hz display: Medium at 8.3 ms, High at 25 ms.
    const changes = simulate(c, (level) => (level === 'high' ? 25 : 8.3), 120000);
    expect(changes.map((x) => x.to)).toEqual(['high', 'medium']);
    expect(c.level).toBe('medium');
  });
  it('still steps up again after a reversal that came long after the step-up', () => {
    const c = createAutoQuality('medium');
    let slowFrom = Number.POSITIVE_INFINITY;
    let t = 0;
    const changes: string[] = [];
    while (t < 90000) {
      const ms = c.level === 'high' && t >= slowFrom && t < slowFrom + 8000 ? 25 : 8.3;
      t += ms;
      const next = c.sample(ms, t);
      if (next) {
        changes.push(next);
        if (next === 'high' && slowFrom === Number.POSITIVE_INFINITY) slowFrom = t + 20000; // a heavy view 20 s later
      }
    }
    expect(changes).toEqual(['high', 'medium', 'high']);
  });
  it('resets the 10 s fast hold across a hidden-tab gap, so no stale step-up follows it', () => {
    const c = createAutoQuality('low');
    const a = run(c, 8, 0, 11000); // fast since ~3 s: 8 s of the 10 s hold done
    expect(a.changes).toEqual([]);
    expect(c.sample(5000, a.end + 5000)).toBeNull(); // the tab was hidden for 5 s
    expect(run(c, 8, a.end + 5000, 5000).changes).toEqual([]);
  });
  it('resets the fast hold on hidden frames too', () => {
    const c = createAutoQuality('low');
    const a = run(c, 8, 0, 11000);
    expect(c.sample(8, a.end + 8, false)).toBeNull();
    expect(run(c, 8, a.end + 8, 5000).changes).toEqual([]);
  });
});

describe('resyncAuto (QualityGovernor)', () => {
  it('keeps the controller that made the change, with its state', () => {
    const c = createAutoQuality('high');
    run(c, 25, 0, 5100); // stepped down to Medium
    expect(c.level).toBe('medium');
    expect(resyncAuto(c, 'medium')).toBe(c);
  });
  it('restarts from a level set by anything else while in Auto', () => {
    const c = createAutoQuality('high');
    const next = resyncAuto(c, 'low');
    expect(next).not.toBe(c);
    expect(next.level).toBe('low');
    expect(resyncAuto(null, 'medium').level).toBe('medium');
  });
});

describe('Auto start-up hitches (M2a.2 residual)', () => {
  /** Real traces measured on the dev machine: two compile/upload hitches about 1 s apart with normal frames between. */
  function feed(c: ReturnType<typeof createAutoQuality>, frames: Array<[number, number]>): string[] {
    let t = 0;
    const out: string[] = [];
    for (const [ms, count] of frames) {
      for (let i = 0; i < count; i++) {
        t += ms;
        const next = c.sample(ms, t);
        if (next) out.push(next);
      }
    }
    return out;
  }
  it('does not drop for start-up hitches separated by normal frames', () => {
    const c = createAutoQuality('high');
    expect(feed(c, [[16.7, 30], [880, 1], [25, 40], [440, 1], [16.7, 600]])).toEqual([]);
    expect(c.level).toBe('high');
  });
  it('does not drop within the cooldown that starts at the first sample', () => {
    const c = createAutoQuality('high');
    expect(feed(c, [[400, 5]])).toEqual([]); // 2 s of consecutive long frames, inside the first 5 s
  });
  it('still drops on sustained long frames once the start-up cooldown is over', () => {
    const c = createAutoQuality('high');
    expect(feed(c, [[16.7, 330], [400, 4]])).toEqual(['low']); // ~5.5 s of normal frames, then 4 x 400 ms in a row
  });
  it('drops on two consecutive long frames totalling more than a second', () => {
    const c = createAutoQuality('high');
    expect(feed(c, [[16.7, 330], [600, 2]])).toEqual(['low']);
  });
});
