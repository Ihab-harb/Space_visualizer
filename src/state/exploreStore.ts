import { create } from 'zustand';
import { useSelectionStore } from './selectionStore';
import { useTimeStore } from './timeStore';
import { useTourStore } from './tourStore';

export type ExploreView = 'whole' | 'exploded' | 'section';

interface ExploreState {
  active: boolean;
  bodyId: string | null;
  view: ExploreView;
  /** 0 = whole, 1 = target view fully open; animated by the scene. */
  progress: number;
  chartOpen: boolean;
  selectedLayerId: string | null;
  /** Bumped when Half-section is chosen again, so the scene re-faces the cut to the camera. */
  sectionSeq: number;
  saved: { playing: boolean; rateIndex: number } | null;
  enter(bodyId: string): void;
  leave(): void;
  setView(v: ExploreView): void;
  setProgress(p: number): void;
  toggleChart(open?: boolean): void;
  selectLayer(id: string | null): void;
}

const IDLE = { active: false, bodyId: null, view: 'whole' as ExploreView, progress: 0, chartOpen: false, selectedLayerId: null, saved: null };

export const useExploreStore = create<ExploreState>()((set, get) => ({
  ...IDLE,
  sectionSeq: 0,
  enter: (bodyId) => {
    useTourStore.getState().stop();
    const time = useTimeStore.getState();
    // Re-entering while active keeps the first saved state: the time the user had before Explore.
    const saved = get().saved ?? { playing: time.playing, rateIndex: time.rateIndex };
    time.setPlaying(false);
    set({ ...IDLE, active: true, bodyId, saved });
  },
  leave: () => {
    const { saved, active } = get();
    if (active && saved) {
      const time = useTimeStore.getState();
      time.setRateIndex(saved.rateIndex);
      time.setPlaying(saved.playing);
    }
    set({ ...IDLE });
  },
  setView: (view) => set((s) => ({ view, sectionSeq: view === 'section' ? s.sectionSeq + 1 : s.sectionSeq })),
  setProgress: (progress) => set({ progress: Math.min(Math.max(progress, 0), 1) }),
  toggleChart: (open) => set((s) => ({ chartOpen: open ?? !s.chartOpen })),
  selectLayer: (selectedLayerId) => set({ selectedLayerId }),
}));

// One place: choosing another body (or none) while exploring ends Explore.
useSelectionStore.subscribe((s) => {
  const e = useExploreStore.getState();
  if (e.active && s.selectedId !== e.bodyId) e.leave();
});
