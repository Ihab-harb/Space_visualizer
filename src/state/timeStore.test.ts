import { beforeEach, describe, expect, it } from 'vitest';
import { JD_MAX, JD_MIN, MAX_FRAME_DT_S, nowJdTdb, RATE_STEPS, useTimeStore } from './timeStore';

const J2000 = 2451545;
beforeEach(() => useTimeStore.setState({ jdTdb: J2000, playing: true, rateIndex: 3, direction: 1 }));

describe('timeStore', () => {
  it('advances by rate x real time', () => {
    useTimeStore.getState().advance(0.05); // 1 day/s for 0.05 s
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(J2000 + 0.05, 12);
  });
  it('clamps a huge frame delta (e.g. returning to a background tab)', () => {
    useTimeStore.getState().advance(30);
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(J2000 + MAX_FRAME_DT_S, 12);
  });
  it('runs backwards and across the 2050 table boundary', () => {
    useTimeStore.setState({ jdTdb: 2470172.6, rateIndex: RATE_STEPS.length - 1, direction: -1 });
    useTimeStore.getState().advance(0.1);
    expect(useTimeStore.getState().jdTdb).toBeLessThan(2470172.5);
  });
  it('does nothing while paused', () => {
    useTimeStore.getState().setPlaying(false);
    useTimeStore.getState().advance(0.05);
    expect(useTimeStore.getState().jdTdb).toBe(J2000);
  });
  it('stops at the supported range limits', () => {
    useTimeStore.setState({ jdTdb: JD_MIN + 1, rateIndex: RATE_STEPS.length - 1, direction: -1 });
    useTimeStore.getState().advance(0.1);
    expect(useTimeStore.getState()).toMatchObject({ jdTdb: JD_MIN, playing: false });
    useTimeStore.getState().setJdTdb(JD_MAX + 100);
    expect(useTimeStore.getState().jdTdb).toBe(JD_MAX);
  });
  it('resets to now in TDB', () => {
    useTimeStore.getState().resetToNow(Date.UTC(2026, 9, 4));
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(2461317.5 + 69.184 / 86400, 9);
    expect(nowJdTdb(Date.UTC(2026, 9, 4))).toBeCloseTo(2461317.5 + 69.184 / 86400, 9);
  });
  it('clamps the rate index', () => {
    useTimeStore.getState().setRateIndex(99);
    expect(useTimeStore.getState().rateIndex).toBe(RATE_STEPS.length - 1);
  });
});
