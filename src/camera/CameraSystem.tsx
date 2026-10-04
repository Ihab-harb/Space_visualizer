import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Matrix4 } from 'three';
import type { Catalog } from '../core/catalog/catalog';
import { DEG } from '../core/math/angles';
import { useFrameState } from '../scene/FrameStateContext';
import type { FrameState } from '../scene/frameState';
import { writeMatrix4 } from '../scene/threeMath';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore, type ViewId } from '../state/viewStore';
import { createFollowController } from './followController';
import { createPointerInput } from './input';
import { createOrbitController } from './orbitController';
import { lookRotation } from './rig';
import { interpolatePose, TRANSITION_SECONDS } from './transition';
import type { CameraPose, ControllerContext } from './types';

const INITIAL_DISTANCE_KM = 2.2e9; // ~14.7 AU: the inner system and Jupiter comfortably in view
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

function makeContext(frame: FrameState, catalog: Catalog): ControllerContext {
  return {
    bodyPosition: (id) => frame.bodyPositionsKm.get(id),
    bodyRadiusKm: (id) => catalog.bodyById.get(id)?.shape.equatorialRadiusKm ?? 1,
    bodyOrientation: (id) => frame.bodyOrientation.get(id),
  };
}

interface Rig {
  orbit: ReturnType<typeof createOrbitController>;
  follow: ReturnType<typeof createFollowController>;
  activeView: ViewId;
  lastPose: CameraPose | null;
  transition: { from: CameraPose; startedAt: number } | null;
  lastFocusSeq: number;
  lastSelectedId: string | null;
  lastCoRotate: boolean;
}

export function CameraSystem({ catalog }: { catalog: Catalog }) {
  const frame = useFrameState();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const input = useMemo(() => createPointerInput(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  useEffect(() => input.attach(gl.domElement), [gl, input]);

  const rig = useRef<Rig | null>(null);
  if (!rig.current) {
    const home = catalog.bodies.find((b) => b.category === 'star')?.id ?? catalog.bodies[0]!.id;
    rig.current = {
      orbit: createOrbitController({ targetId: home, distanceKm: INITIAL_DISTANCE_KM, azimuthRad: -90 * DEG, elevationRad: 30 * DEG, panOffsetKm: [0, 0, 0] }),
      follow: createFollowController({ targetId: home, distanceKm: 1, azimuthRad: 0, elevationRad: 0.3, coRotate: false }),
      activeView: 'orbit',
      lastPose: null,
      transition: null,
      lastFocusSeq: 0,
      lastSelectedId: null,
      lastCoRotate: false,
    };
  }

  useFrame((state) => {
    const r = rig.current!;
    const ctx = makeContext(frame, catalog);
    const now = state.clock.elapsedTime;
    const { view, coRotate, focusRequest } = useViewStore.getState();
    const selectedId = useSelectionStore.getState().selectedId;
    const startTransition = () => {
      if (r.lastPose) r.transition = { from: r.lastPose, startedAt: now };
    };

    if (view !== r.activeView) {
      if (view === 'follow') r.follow.enter(r.lastPose, ctx, selectedId ?? r.orbit.getState().targetId);
      else r.orbit.enter(r.lastPose, ctx);
      r.activeView = view;
      startTransition();
    }
    if (view === 'follow' && selectedId && selectedId !== r.lastSelectedId && selectedId !== r.follow.getState().targetId) {
      r.follow.setTarget(selectedId, ctx);
      startTransition();
    }
    r.lastSelectedId = selectedId;
    if (focusRequest && focusRequest.seq !== r.lastFocusSeq) {
      r.lastFocusSeq = focusRequest.seq;
      if (view === 'orbit') {
        r.orbit.focus(focusRequest.bodyId, ctx);
        startTransition();
      } else {
        useSelectionStore.getState().select(focusRequest.bodyId);
      }
    }
    if (coRotate !== r.lastCoRotate) {
      r.follow.setCoRotate(coRotate, ctx);
      r.lastCoRotate = coRotate;
    }

    let pose = (view === 'follow' ? r.follow : r.orbit).update(input.consume(), ctx);
    if (r.transition) {
      const s = prefersReducedMotion() ? 1 : (now - r.transition.startedAt) / TRANSITION_SECONDS;
      pose = interpolatePose(r.transition.from, pose, s);
      if (s >= 1) r.transition = null;
    }
    r.lastPose = pose;
    frame.cameraPositionKm = pose.positionKm;
    camera.position.set(0, 0, 0);
    camera.quaternion.setFromRotationMatrix(writeMatrix4(lookRotation(pose.positionKm, pose.lookAtKm), matrix));
  }, -1);

  return null;
}
