import { create } from 'zustand';

interface UiState {
  drawerOpen: boolean;
  /** Phone only: the control panel collapses behind a Controls button. */
  controlsOpen: boolean;
  /** A source the drawer should scroll to once open (set by header citations). */
  focusSource: string | null;
  setDrawerOpen(open: boolean): void;
  toggleDrawer(): void;
  toggleControls(): void;
  revealSource(sourceId: string): void;
  clearFocusSource(): void;
}

export const useUiStore = create<UiState>()((set) => ({
  drawerOpen: false,
  controlsOpen: false,
  focusSource: null,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  toggleControls: () => set((s) => ({ controlsOpen: !s.controlsOpen })),
  revealSource: (focusSource) => set({ drawerOpen: true, focusSource }),
  clearFocusSource: () => set({ focusSource: null }),
}));
