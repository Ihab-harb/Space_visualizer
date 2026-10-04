import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PointLight } from 'three';
import { useFrameState } from './FrameStateContext';

/** The Sun is the scene's only real light. decay 0 keeps the outer planets lit (no inverse-square dimming). */
export function SunLight({ bodyId }: { bodyId: string }) {
  const frame = useFrameState();
  const light = useRef<PointLight>(null);
  useFrame(() => {
    const p = frame.bodyPositionsKm.get(bodyId);
    if (!p || !light.current) return;
    const c = frame.cameraPositionKm;
    light.current.position.set(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
  });
  return <pointLight ref={light} intensity={3} decay={0} distance={0} />;
}
