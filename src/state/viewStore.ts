import { create } from 'zustand';
import type { Tier } from '../core/catalog/schema';

export type ViewId = 'orbit' | 'follow';
export type ScaleMode = 'readable' | 'true';

export interface CameraOverride {
  targetId: string;
  distanceKm?: number;
  azDeg?: number;
  azFromSunDeg?: number;
  elDeg?: number;
  seq: number;
}

interface ViewState {
  view: ViewId;
  coRotate: boolean;
  scaleMode: ScaleMode;
  /** Orbit view: move the pivot to this body. seq makes repeated requests distinct. */
  focusRequest: { bodyId: string; seq: number } | null;
  textureTierOverride: Tier | null;
  /** Venus: show the Magellan radar mosaic instead of the cloud deck. */
  venusRadar: boolean;
  setVenusRadar(on: boolean): void;
  cameraOverride: CameraOverride | null;
  setTextureTierOverride(tier: Tier | null): void;
  requestCameraOverride(o: Omit<CameraOverride, 'seq'>): void;
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
  textureTierOverride: null,
  venusRadar: false,
  setVenusRadar: (venusRadar) => set({ venusRadar }),
  cameraOverride: null,
  setTextureTierOverride: (textureTierOverride) => set({ textureTierOverride }),
  requestCameraOverride: (o) => set((s) => ({ cameraOverride: { ...o, seq: (s.cameraOverride?.seq ?? 0) + 1 } })),
  setView: (view) => set({ view }),
  toggleCoRotate: () => set((s) => ({ coRotate: !s.coRotate })),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  requestFocus: (bodyId) => set((s) => ({ focusRequest: { bodyId, seq: (s.focusRequest?.seq ?? 0) + 1 } })),
}));
