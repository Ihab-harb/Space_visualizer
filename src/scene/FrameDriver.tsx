import { useFrame } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import type { Catalog } from '../core/catalog/catalog';
import { DEG } from '../core/math/angles';
import { useTimeStore } from '../state/timeStore';
import { useFrameState } from './FrameStateContext';
import { updateBodies } from './frameState';

export function FrameDriver({ catalog }: { catalog: Catalog }) {
  const frame = useFrameState();
  useFrame((state, delta) => {
    const time = useTimeStore.getState();
    time.advance(delta);
    updateBodies(frame, catalog.bodies, catalog.ephemerisTables, useTimeStore.getState().jdTdb);
    frame.viewportHeightPx = state.size.height;
    frame.fovRad = (state.camera as PerspectiveCamera).fov * DEG;
  }, -2);
  return null;
}
