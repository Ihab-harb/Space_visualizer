import { stepDown, stepUp, type QualityLevel } from './quality';

/** Spec §5 Auto mode. */
export const AUTO_QUALITY = {
  warmupMs: 3000,
  windowMs: 2000,
  downAboveMs: 18,
  upBelowMs: 12,
  upHoldMs: 10000,
  cooldownMs: 5000,
  /** Frames longer than this (tab switch, debugger pause) are not performance evidence. */
  ignoreAboveMs: 250,
} as const;

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function createAutoQuality(start: QualityLevel, config: typeof AUTO_QUALITY = AUTO_QUALITY) {
  let level = start;
  let startedAt: number | null = null;
  let lastChangeAt = Number.NEGATIVE_INFINITY;
  let fastSince: number | null = null;
  let window: Array<{ t: number; ms: number }> = [];

  const change = (next: QualityLevel, now: number): QualityLevel | null => {
    if (next === level) return null;
    level = next;
    lastChangeAt = now;
    window = [];
    fastSince = null;
    return level;
  };

  return {
    get level() {
      return level;
    },
    sample(frameMs: number, nowMs: number): QualityLevel | null {
      if (startedAt === null) startedAt = nowMs;
      if (!(frameMs > 0) || frameMs > config.ignoreAboveMs) return null;
      window.push({ t: nowMs, ms: frameMs });
      while (window.length > 0 && window[0]!.t < nowMs - config.windowMs) window.shift();
      if (nowMs - startedAt < config.warmupMs) return null;
      if (nowMs - lastChangeAt < config.cooldownMs) return null;
      const covered = window.length > 1 ? nowMs - window[0]!.t : 0;
      if (covered < config.windowMs * 0.9) return null;
      const m = median(window.map((s) => s.ms));
      if (m > config.downAboveMs) return change(stepDown(level), nowMs);
      if (m < config.upBelowMs) {
        fastSince ??= nowMs;
        if (nowMs - fastSince >= config.upHoldMs) return change(stepUp(level), nowMs);
      } else {
        fastSince = null;
      }
      return null;
    },
  };
}
