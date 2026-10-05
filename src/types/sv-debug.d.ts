interface Window {
  /** Dev-only: names of the effects in each composer pass, in render order (e2e assembly checks). */
  __svPasses?: () => string[][];
}
