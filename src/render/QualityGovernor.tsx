import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useRenderStore } from '../state/renderStore';
import { createAutoQuality } from './autoQuality';
import { pixelRatioFor } from './quality';

/** Applies the pixel ratio for the current level and, in Auto mode, adjusts the level from measured frame times. */
export function QualityGovernor() {
  const setDpr = useThree((s) => s.setDpr);
  const level = useRenderStore((s) => s.level);
  const mode = useRenderStore((s) => s.mode);
  const controller = useRef(createAutoQuality(level));

  useEffect(() => {
    setDpr(pixelRatioFor(level, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  }, [level, setDpr]);
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
