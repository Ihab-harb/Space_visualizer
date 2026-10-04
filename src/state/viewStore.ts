import { create } from 'zustand';

export type ViewId = 'orbit' | 'follow';
export type ScaleMode = 'readable' | 'true';

interface ViewState {
  view: ViewId;
  coRotate: boolean;
  scaleMode: ScaleMode;
  /** Orbit view: move the pivot to this body. seq makes repeated requests distinct. */
  focusRequest: { bodyId: string; seq: number } | null;
  setView(view: ViewId): void;
  toggleCoRotate(): void;
  setScaleMode(mode: ScaleMode): void;
  requestFocus(bodyId: string): void;
}

export const useViewStore = create<ViewState>()((set) => ({
  view: 'orbit',
  coRotate: false,
  scaleMode: 'readable',
  focusRequest: null,
  setView: (view) => set({ view }),
  toggleCoRotate: () => set((s) => ({ coRotate: !s.coRotate })),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  requestFocus: (bodyId) => set((s) => ({ focusRequest: { bodyId, seq: (s.focusRequest?.seq ?? 0) + 1 } })),
}));
