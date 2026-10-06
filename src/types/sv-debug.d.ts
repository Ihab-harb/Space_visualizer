interface Window {
  /** Dev-only: names of the effects in each composer pass, in render order (e2e assembly checks). */
  __svPasses?: () => string[][];
  /** Dev-only: the current EffectComposer instance, so e2e tests can tell a rebuild from a kept composer. */
  __svComposer?: () => object | null;
  /** Dev-only: live WebGL resource counts for leak tests. */
  __svRenderInfo?: () => { textures: number; geometries: number; programs: number };
}
