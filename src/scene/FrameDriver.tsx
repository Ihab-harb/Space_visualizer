import { useFrame } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import type { Body } from '../core/catalog/schema';
import { DEG } from '../core/math/angles';
import { useTimeStore } from '../state/timeStore';
import { useFrameState } from './FrameStateContext';
import { updateBodies } from './frameState';

export function FrameDriver({ bodies }: { bodies: readonly Body[] }) {
  const frame = useFrameState();
  useFrame((state, delta) => {
    const time = useTimeStore.getState();
    time.advance(delta);
    updateBodies(frame, bodies, useTimeStore.getState().jdTdb);
    frame.viewportHeightPx = state.size.height;
    frame.fovRad = (state.camera as PerspectiveCamera).fov * DEG;
  }, -2);
  return null;
}
