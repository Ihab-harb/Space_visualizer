import { LEVELS_LOW_TO_HIGH, stepDown, stepUp, type QualityLevel } from './quality';

/** Spec §5 Auto mode. */
export const AUTO_QUALITY = {
  warmupMs: 3000,
  windowMs: 2000,
  downAboveMs: 18,
  upBelowMs: 12,
  upHoldMs: 10000,
  cooldownMs: 5000,
  /** Frames longer than this (tab switch, debugger pause, one-off hitch) never enter the median. */
  ignoreAboveMs: 250,
  /**
   * Long frames are evidence when they persist (final-review ruling C1): this many consecutive ones, or at least two
   * consecutive ones totalling more than longWithinWindowMs, drop straight to Low. Any normal frame resets the run, so
   * start-up compile hitches separated by normal frames never add up. A frame longer than the whole window is a
   * pause, not rendering, and never counts.
   */
  longRunFrames: 3,
  longWithinWindowMs: 1000,
} as const;

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export type AutoQuality = ReturnType<typeof createAutoQuality>;

interface Sample {
  t: number;
  ms: number;
}

export function createAutoQuality(start: QualityLevel, config: typeof AUTO_QUALITY = AUTO_QUALITY) {
  let level = start;
  let startedAt: number | null = null;
  let lastChangeAt = Number.NEGATIVE_INFINITY;
  let fastSince: number | null = null;
  let window: Sample[] = [];
  /** The current run of consecutive long frames (over ignoreAboveMs, up to windowMs); any normal frame resets it. */
  let longRun = 0;
  let longRunMs = 0;
  /** The last step up, so a quick reversal can block that level (back-off, ruling I2). */
  let lastUp: { to: QualityLevel; at: number } | null = null;
  /** Levels a step-up may no longer reach for this controller's life (Auto entry creates a new controller). */
  const blocked = new Set<QualityLevel>();

  const rank = (l: QualityLevel) => LEVELS_LOW_TO_HIGH.indexOf(l);
  const change = (next: QualityLevel, now: number): QualityLevel | null => {
    if (next === level) return null;
    if (rank(next) < rank(level)) {
      // A step up reversed within cooldown + window: that level cannot hold, so never try it again.
      if (lastUp && lastUp.to === level && now - lastUp.at <= config.cooldownMs + config.windowMs) blocked.add(level);
      lastUp = null;
    } else {
      lastUp = { to: next, at: now };
    }
    level = next;
    lastChangeAt = now;
    window = [];
    longRun = 0;
    longRunMs = 0;
    fastSince = null;
    return level;
  };

  return {
    get level() {
      return level;
    },
    /** One frame. visible is false while the page is hidden; such frames never count. Returns the new level on a change. */
    sample(frameMs: number, nowMs: number, visible = true): QualityLevel | null {
      if (startedAt === null) {
        // The cooldown covers start-up and Auto entry (resyncAuto creates a new controller on entry): the first
        // seconds compile shaders and upload textures, which says nothing about steady rendering.
        startedAt = nowMs;
        lastChangeAt = nowMs;
      }
      if (!(frameMs > 0)) return null;
      if (!visible || frameMs > config.windowMs) {
        // Hidden, or a pause longer than the window: no evidence either way, and the fast hold starts again.
        fastSince = null;
        longRun = 0;
        longRunMs = 0;
        return null;
      }
      if (frameMs > config.ignoreAboveMs) {
        fastSince = null;
        longRun++;
        longRunMs += frameMs;
        const sustained = longRun >= config.longRunFrames || (longRun >= 2 && longRunMs > config.longWithinWindowMs);
        // Ignores the warm-up, but not the cooldown: the rebuild after a change compiles shaders in long frames.
        if (sustained && nowMs - lastChangeAt >= config.cooldownMs) return change('low', nowMs);
        return null;
      }
      longRun = 0;
      longRunMs = 0;
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
        const up = stepUp(level);
        if (!blocked.has(up) && nowMs - fastSince >= config.upHoldMs) return change(up, nowMs);
      } else {
        fastSince = null;
      }
      return null;
    },
  };
}

/** The controller to keep after the level changed: the same one if it made the change, else a fresh one at that level. */
export function resyncAuto(current: AutoQuality | null, level: QualityLevel): AutoQuality {
  return current !== null && current.level === level ? current : createAutoQuality(level);
}
