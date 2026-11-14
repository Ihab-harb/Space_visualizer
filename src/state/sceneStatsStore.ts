import { create } from 'zustand';

interface SceneStats {
  bodiesInView: number;
  setBodiesInView(n: number): void;
}

export const useSceneStatsStore = create<SceneStats>()((set) => ({
  bodiesInView: 0,
  setBodiesInView: (bodiesInView) => set((s) => (s.bodiesInView === bodiesInView ? s : { bodiesInView })),
}));
