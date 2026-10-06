const ORDER = ['low', 'medium', 'high'];

export interface AutoAnalysis {
  changes: number;
  /** A step down followed later by a step up, or the reverse. */
  reversed: boolean;
  /** The level did not change over the last `settleSamples` samples. */
  settled: boolean;
}

/** Analyses sampled `data-quality` values from an Auto run (used by the perf probe). */
export function analyseAutoLevels(levels: readonly string[], settleSamples = 10): AutoAnalysis {
  let changes = 0;
  let lastDir = 0;
  let reversed = false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] === levels[i - 1]) continue;
    changes++;
    const dir = Math.sign(ORDER.indexOf(levels[i]!) - ORDER.indexOf(levels[i - 1]!));
    if (lastDir !== 0 && dir !== lastDir) reversed = true;
    lastDir = dir;
  }
  const tail = levels.slice(-settleSamples);
  const settled = tail.length >= settleSamples && tail.every((l) => l === tail[0]);
  return { changes, reversed, settled };
}
