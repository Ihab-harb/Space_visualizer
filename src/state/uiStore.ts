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
  // On phones the open Controls dropdown and the drawer sheet cannot both fit, so opening one closes the other.
  setDrawerOpen: (drawerOpen) => set(drawerOpen ? { drawerOpen, controlsOpen: false } : { drawerOpen }),
  toggleDrawer: () => set((s) => (s.drawerOpen ? { drawerOpen: false } : { drawerOpen: true, controlsOpen: false })),
  toggleControls: () => set((s) => (s.controlsOpen ? { controlsOpen: false } : { controlsOpen: true, drawerOpen: false })),
  revealSource: (focusSource) => set({ drawerOpen: true, controlsOpen: false, focusSource }),
  clearFocusSource: () => set({ focusSource: null }),
}));
