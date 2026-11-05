import { describe, expect, it } from 'vitest';
import { CLOSED, easeInOut, OPEN_SECONDS, stepTransition, type TransitionInput, type TransitionState } from './exploreTransition';

const input = (over: Partial<TransitionInput> = {}): TransitionInput => ({
  active: true, bodyId: 'earth', view: 'exploded', sectionSeq: 0, reducedMotion: false, ready: true, ...over,
});

/** Runs the stepper for `seconds` in 1/60 s frames. */
function run(s: TransitionState, inp: TransitionInput, seconds: number): TransitionState {
  let out = s;
  for (let i = 0; i < Math.round(seconds * 60); i++) out = stepTransition(out, inp, 1 / 60);
  return out;
}

describe('stepTransition', () => {
  it('opens a session on entry and reaches the view in OPEN_SECONDS', () => {
    const first = stepTransition(CLOSED, input(), 1 / 60);
    expect(first.bodyId).toBe('earth');
    expect(first.view).toBe('exploded');
    expect(first.t).toBeGreaterThan(0);
    const half = run(CLOSED, input(), OPEN_SECONDS / 2);
    expect(half.t).toBeCloseTo(0.5, 1);
    const done = run(CLOSED, input(), OPEN_SECONDS + 0.1);
    expect(done.t).toBe(1);
    expect(done.focus).toBe(1);
  });

  it('jumps under reduced motion', () => {
    const s = stepTransition(CLOSED, input({ reducedMotion: true }), 1 / 60);
    expect(s.t).toBe(1);
    expect(s.focus).toBe(1);
    const left = stepTransition(s, input({ active: false, bodyId: null, reducedMotion: true }), 1 / 60);
    expect(left).toEqual(CLOSED);
  });

  it('a leave mid-transition reverses from the current progress, then ends the session', () => {
    const mid = run(CLOSED, input(), OPEN_SECONDS / 2);
    const back = stepTransition(mid, input({ active: false, bodyId: null }), 1 / 60);
    expect(back.t).toBeLessThan(mid.t);
    expect(back.t).toBeGreaterThan(mid.t - 0.05); // no jump
    expect(back.bodyId).toBe('earth'); // still closing
    const closed = run(back, input({ active: false, bodyId: null }), OPEN_SECONDS);
    expect(closed).toEqual(CLOSED);
  });

  it('re-entering while closing turns round from where it is', () => {
    const open = run(CLOSED, input(), OPEN_SECONDS);
    const closing = run(open, input({ active: false, bodyId: null }), 0.3);
    const again = stepTransition(closing, input(), 1 / 60);
    expect(again.t).toBeGreaterThan(closing.t);
    expect(again.bodyId).toBe('earth');
  });

  it('switching views closes the current view first, then opens the new one', () => {
    const open = run(CLOSED, input({ view: 'exploded' }), OPEN_SECONDS);
    const switching = stepTransition(open, input({ view: 'section', sectionSeq: 1 }), 1 / 60);
    expect(switching.view).toBe('exploded');
    expect(switching.t).toBeLessThan(1);
    const later = run(switching, input({ view: 'section', sectionSeq: 1 }), 2 * OPEN_SECONDS);
    expect(later.view).toBe('section');
    expect(later.sectionSeq).toBe(1);
    expect(later.t).toBe(1);
  });

  it('choosing Half-section again closes and reopens the cut (to face the camera anew)', () => {
    const open = run(CLOSED, input({ view: 'section', sectionSeq: 1 }), OPEN_SECONDS);
    expect(open.sectionSeq).toBe(1);
    const again = stepTransition(open, input({ view: 'section', sectionSeq: 2 }), 1 / 60);
    expect(again.t).toBeLessThan(1);
    expect(again.sectionSeq).toBe(1);
    const reopened = run(again, input({ view: 'section', sectionSeq: 2 }), 2 * OPEN_SECONDS);
    expect(reopened.sectionSeq).toBe(2);
    expect(reopened.t).toBe(1);
  });

  it('Whole keeps the body closed but the session (dimming) on', () => {
    const s = run(CLOSED, input({ view: 'whole' }), OPEN_SECONDS);
    expect(s.bodyId).toBe('earth');
    expect(s.t).toBe(0);
    expect(s.focus).toBe(1);
  });

  it('stays closed until the layers are ready', () => {
    const waiting = run(CLOSED, input({ ready: false }), 0.5);
    expect(waiting.t).toBe(0);
    const ready = run(waiting, input(), 0.2);
    expect(ready.t).toBeGreaterThan(0);
  });

  it('another body while active: closes the first, then opens the second without leaving the session', () => {
    const open = run(CLOSED, input(), OPEN_SECONDS);
    const switching = run(open, input({ bodyId: 'mars' }), OPEN_SECONDS / 2);
    expect(switching.bodyId).toBe('earth');
    const later = run(switching, input({ bodyId: 'mars' }), 2 * OPEN_SECONDS);
    expect(later.bodyId).toBe('mars');
    expect(later.t).toBe(1);
    expect(later.focus).toBe(1);
  });

  it('never leaves [0, 1] and survives a huge or negative dt', () => {
    const a = stepTransition(CLOSED, input(), 100);
    expect(a.t).toBe(1);
    const b = stepTransition(a, input(), -5);
    expect(b.t).toBe(1);
  });
});

describe('easeInOut', () => {
  it('is 0 and 1 at the ends, 0.5 in the middle and monotonic', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    for (let t = 0; t < 1; t += 0.05) expect(easeInOut(t + 0.05)).toBeGreaterThanOrEqual(easeInOut(t));
  });
});
