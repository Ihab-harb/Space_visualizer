import { create } from 'zustand';

interface TourState {
  active: boolean;
  /** Incremented on every start, so the camera can tell a new tour from a running one. */
  seq: number;
  start(): void;
  stop(): void;
  toggle(): void;
}

export const useTourStore = create<TourState>()((set, get) => ({
  active: false,
  seq: 0,
  start: () => set((s) => ({ active: true, seq: s.seq + 1 })),
  stop: () => set({ active: false }),
  toggle: () => (get().active ? get().stop() : get().start()),
}));
