import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useRenderStore } from '../state/renderStore';
import { createAutoQuality } from './autoQuality';

/**
 * In Auto mode, adjusts the level from measured frame times. The pixel ratio itself is applied by the Canvas dpr prop
 * (SceneRoot, via canvasDpr), so a Canvas re-render can never reset it; no setDpr call is needed here.
 */
export function QualityGovernor() {
  const level = useRenderStore((s) => s.level);
  const mode = useRenderStore((s) => s.mode);
  const controller = useRef(createAutoQuality(level));

  useEffect(() => {
    if (mode === 'auto') controller.current = createAutoQuality(useRenderStore.getState().level);
  }, [mode]);

  useFrame((_, delta) => {
    if (useRenderStore.getState().mode !== 'auto') return;
    const next = controller.current.sample(delta * 1000, performance.now());
    if (next) useRenderStore.getState().setLevel(next);
  });
  return null;
}
