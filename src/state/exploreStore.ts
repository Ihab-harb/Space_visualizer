import { create } from 'zustand';
import { useSelectionStore } from './selectionStore';
import { useTimeStore } from './timeStore';
import { useTourStore } from './tourStore';

export type ExploreView = 'whole' | 'exploded' | 'section';
/** The two tabs: Surface is the 'whole' view, Interior is Exploded or Half-section. */
export type ExploreTab = 'surface' | 'interior';
export const tabOf = (view: ExploreView): ExploreTab => (view === 'whole' ? 'surface' : 'interior');

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
  /** The interior view Interior opens on: Exploded first, then whichever was used last. */
  lastInteriorView: 'exploded' | 'section';
  selectedFeatureId: string | null;
  /** Bumped by every selectFeature(id !== null), also for the same id, so the camera turns to it again. */
  featureSeq: number;
  featureListOpen: boolean;
  saved: { playing: boolean; rateIndex: number } | null;
  enter(bodyId: string): void;
  leave(): void;
  setView(v: ExploreView): void;
  setProgress(p: number): void;
  toggleChart(open?: boolean): void;
  selectLayer(id: string | null): void;
  setTab(tab: ExploreTab): void;
  selectFeature(id: string | null): void;
  toggleFeatureList(open?: boolean): void;
}

const IDLE = { active: false, bodyId: null, view: 'whole' as ExploreView, progress: 0, chartOpen: false, selectedLayerId: null, saved: null, lastInteriorView: 'exploded' as 'exploded' | 'section', selectedFeatureId: null, featureListOpen: false };

export const useExploreStore = create<ExploreState>()((set, get) => ({
  ...IDLE,
  sectionSeq: 0,
  featureSeq: 0,
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
  setView: (view) =>
    set((s) => ({
      view,
      sectionSeq: view === 'section' ? s.sectionSeq + 1 : s.sectionSeq,
      // An interior view has no surface pins: it remembers itself and drops the feature and the list.
      ...(view === 'whole' ? { selectedLayerId: null } : { lastInteriorView: view, selectedFeatureId: null, featureListOpen: false }),
    })),
  setProgress: (progress) => set({ progress: Math.min(Math.max(progress, 0), 1) }),
  toggleChart: (open) => set((s) => ({ chartOpen: open ?? !s.chartOpen })),
  selectLayer: (selectedLayerId) => set({ selectedLayerId }),
  setTab: (tab) => get().setView(tab === 'surface' ? 'whole' : get().lastInteriorView),
  selectFeature: (id) =>
    set((s) => (id === null ? { selectedFeatureId: null } : { selectedFeatureId: id, view: 'whole' as ExploreView, selectedLayerId: null, featureSeq: s.featureSeq + 1 })),
  toggleFeatureList: (open) =>
    set((s) => {
      const featureListOpen = open ?? !s.featureListOpen;
      // The list belongs to Surface.
      return featureListOpen && s.view !== 'whole' ? { featureListOpen, view: 'whole' as ExploreView, selectedLayerId: null } : { featureListOpen };
    }),
}));

// One place: choosing another body (or none) while exploring ends Explore.
useSelectionStore.subscribe((s) => {
  const e = useExploreStore.getState();
  if (e.active && s.selectedId !== e.bodyId) e.leave();
});

/**
 * The scene's Explore session: the body whose interior is on show, from the first frame after `enter` until the body has
 * fully closed after `leave` (exactly while `frame.explore` is set). Written only by the scene's Explore driver; the
 * normal interface stays hidden while it is set, so it returns only after the body has closed (spec §3.1).
 */
export const useExploreSession = create<{ bodyId: string | null }>()(() => ({ bodyId: null }));

/** True while Explore owns the screen: the store is active, or the scene is still closing the body. */
export function useExploreOwnsScreen(): boolean {
  const active = useExploreStore((s) => s.active);
  const closing = useExploreSession((s) => s.bodyId !== null);
  return active || closing;
}

/** A click in the scene that hit nothing (the Canvas's onPointerMissed; drags excluded): clears the selected layer in Explore. */
export function clearLayerOnEmptyClick(): void {
  const ex = useExploreStore.getState();
  if (ex.active && ex.selectedLayerId !== null) ex.selectLayer(null);
}

/**
 * A click in the scene on empty space (onPointerMissed) or on the explored body itself (BodyMesh), drags excluded: clears
 * the selected feature in Explore. The pins are DOM in the label layer, so a click on a pin never reaches the scene.
 */
export function clearFeatureOnEmptyClick(): void {
  const ex = useExploreStore.getState();
  if (ex.active && ex.selectedFeatureId !== null) ex.selectFeature(null);
}
