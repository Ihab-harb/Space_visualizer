import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useRenderStore } from '../state/renderStore';
import { createAutoQuality, resyncAuto, type AutoQuality } from './autoQuality';

/**
 * In Auto mode, adjusts the level from measured frame times. The pixel ratio itself is applied by the Canvas dpr prop
 * (SceneRoot, via canvasDpr), so a Canvas re-render can never reset it; no setDpr call is needed here.
 */
export function QualityGovernor() {
  const level = useRenderStore((s) => s.level);
  const mode = useRenderStore((s) => s.mode);
  const gl = useThree((s) => s.gl);
  /** Created lazily; every entry into Auto starts a fresh controller (warm-up, back-off) from the store's reset level. */
  const controller = useRef<AutoQuality | null>(null);

  useEffect(() => {
    if (mode === 'auto') controller.current = createAutoQuality(useRenderStore.getState().level);
  }, [mode]);
  useEffect(() => {
    // A level set by anything other than the controller while in Auto restarts the controller from that level.
    if (mode === 'auto') controller.current = resyncAuto(controller.current, level);
  }, [mode, level]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__svRenderInfo = () => ({
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      programs: gl.info.programs?.length ?? 0,
    });
    return () => {
      delete window.__svRenderInfo;
    };
  }, [gl]);

  useFrame((_, delta) => {
    const store = useRenderStore.getState();
    if (store.mode !== 'auto') return;
    controller.current ??= createAutoQuality(store.level);
    const next = controller.current.sample(delta * 1000, performance.now(), document.visibilityState === 'visible');
    if (next) store.setLevel(next);
  });
  return null;
}
