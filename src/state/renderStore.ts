import { create } from 'zustand';
import { initialLevel, nextMode, type QualityLevel, type QualityMode } from '../render/quality';

const environment = () =>
  typeof window === 'undefined'
    ? { coarsePointer: false, viewportWidth: 1920 }
    : { coarsePointer: window.matchMedia?.('(pointer: coarse)').matches === true, viewportWidth: window.innerWidth };

interface RenderState {
  mode: QualityMode;
  /** Effective level: the fixed mode's level, or Auto's current choice. */
  level: QualityLevel;
  /** Camera effects (spec §5 toggle). */
  effects: boolean;
  setMode(mode: QualityMode): void;
  cycleMode(): void;
  setLevel(level: QualityLevel): void;
  setEffects(on: boolean): void;
  toggleEffects(): void;
}

export const useRenderStore = create<RenderState>()((set, get) => ({
  mode: 'auto',
  level: initialLevel(environment()),
  effects: true,
  // Entering Auto restarts from the initial level: frame times are capped at vsync, so Auto can always step down but
  // cannot see headroom to step up at 60 Hz (final-review ruling I3).
  setMode: (mode) => set(mode === 'auto' ? { mode, level: initialLevel(environment()) } : { mode, level: mode }),
  cycleMode: () => get().setMode(nextMode(get().mode)),
  setLevel: (level) => set({ level }),
  setEffects: (effects) => set({ effects }),
  toggleEffects: () => set((s) => ({ effects: !s.effects })),
}));
