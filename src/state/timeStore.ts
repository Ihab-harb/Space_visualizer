import { create } from 'zustand';
import { unixMsToJd } from '../core/time/julian';
import { utcToTdb } from '../core/time/timescales';
import { SECONDS_PER_DAY } from '../core/units';

export const RATE_STEPS = [
  { secondsPerSecond: 1, label: 'Real time' },
  { secondsPerSecond: 60, label: '1 min/s' },
  { secondsPerSecond: 3_600, label: '1 hour/s' },
  { secondsPerSecond: 86_400, label: '1 day/s' },
  { secondsPerSecond: 604_800, label: '1 week/s' },
  { secondsPerSecond: 2_629_800, label: '1 month/s' }, // Julian year / 12
  { secondsPerSecond: 31_557_600, label: '1 year/s' }, // Julian year
] as const;

/** Longest real-time step applied in one frame (prevents jumps after a backgrounded tab). */
export const MAX_FRAME_DT_S = 0.1;
/** Supported simulation range: JD 0 (4713 BC) to 10000-01-01. */
export const JD_MIN = 0;
export const JD_MAX = 5_373_484.5;

const clampJd = (jd: number) => Math.min(Math.max(jd, JD_MIN), JD_MAX);

export function nowJdTdb(nowMs: number = Date.now()): number {
  return utcToTdb(unixMsToJd(nowMs));
}

interface TimeState {
  jdTdb: number;
  playing: boolean;
  rateIndex: number;
  direction: 1 | -1;
  advance(realDtSeconds: number): void;
  setJdTdb(jd: number): void;
  setPlaying(playing: boolean): void;
  togglePlaying(): void;
  setRateIndex(index: number): void;
  toggleDirection(): void;
  resetToNow(nowMs?: number): void;
}

export const useTimeStore = create<TimeState>()((set, get) => ({
  jdTdb: nowJdTdb(),
  playing: true,
  rateIndex: 0,
  direction: 1,
  advance: (realDtSeconds) => {
    const s = get();
    if (!s.playing) return;
    const dt = Math.min(Math.max(realDtSeconds, 0), MAX_FRAME_DT_S);
    const next = s.jdTdb + (s.direction * RATE_STEPS[s.rateIndex]!.secondsPerSecond * dt) / SECONDS_PER_DAY;
    const clamped = clampJd(next);
    set({ jdTdb: clamped, playing: clamped === next });
  },
  setJdTdb: (jd) => set({ jdTdb: clampJd(jd) }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  setRateIndex: (index) => set({ rateIndex: Math.min(Math.max(Math.round(index), 0), RATE_STEPS.length - 1) }),
  toggleDirection: () => set((s) => ({ direction: s.direction === 1 ? -1 : 1 })),
  resetToNow: (nowMs) => set({ jdTdb: nowJdTdb(nowMs) }),
}));
