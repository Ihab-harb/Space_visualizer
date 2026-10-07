import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Matrix4 } from 'three';
import type { Catalog } from '../core/catalog/catalog';
import { DEG } from '../core/math/angles';
import { useFrameState } from '../scene/FrameStateContext';
import type { FrameState } from '../scene/frameState';
import { writeMatrix4 } from '../scene/threeMath';
import { useSelectionStore } from '../state/selectionStore';
import { useTourStore } from '../state/tourStore';
import { useViewStore, type ViewId } from '../state/viewStore';
import { createFollowController } from './followController';
import { createPointerInput } from './input';
import { createOrbitController } from './orbitController';
import { lookRotation } from './rig';
import { interpolatePose, TRANSITION_SECONDS } from './transition';
import { buildTour, litAzimuth, stopPose, TOUR, tourPhase, type TourStop } from './tour';
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
  lastOverrideSeq: number;
  tour: { seq: number; startedAt: number; stops: TourStop[]; index: number; flightFrom: CameraPose | null } | null;
}

export function CameraSystem({ catalog }: { catalog: Catalog }) {
  const frame = useFrameState();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const input = useMemo(() => createPointerInput(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  useEffect(() => input.attach(gl.domElement, gl.domElement.closest<HTMLElement>('.scene') ?? gl.domElement), [gl, input]);

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
      lastOverrideSeq: 0,
      tour: null,
    };
  }

  useFrame((state) => {
    const r = rig.current!;
    const ctx = makeContext(frame, catalog);
    const override = useViewStore.getState().cameraOverride;
    if (override && override.seq !== r.lastOverrideSeq) {
      r.lastOverrideSeq = override.seq;
      useViewStore.getState().setView('orbit');
      r.activeView = 'orbit';
      r.orbit.focus(override.targetId, ctx);
      let azimuthRad = override.azDeg !== undefined ? override.azDeg * DEG : undefined;
      if (override.azFromSunDeg !== undefined) {
        const body = ctx.bodyPosition(override.targetId) ?? [0, 0, 0];
        const sunId = catalog.bodies.find((b) => b.category === 'star')?.id;
        const sun = (sunId && ctx.bodyPosition(sunId)) || [0, 0, 0];
        azimuthRad = Math.atan2(sun[1] - body[1], sun[0] - body[0]) + override.azFromSunDeg * DEG;
      }
      r.orbit.setView({ distanceKm: override.distanceKm, azimuthRad, elevationRad: override.elDeg !== undefined ? override.elDeg * DEG : undefined });
      r.transition = null;
    }
    const now = state.clock.elapsedTime;
    const tourState = useTourStore.getState();
    if (tourState.active) {
      if (!r.tour || r.tour.seq !== tourState.seq) {
        r.tour = { seq: tourState.seq, startedAt: now, stops: buildTour(catalog.bodies), index: -1, flightFrom: r.lastPose };
        useViewStore.getState().setView('orbit');
        r.activeView = 'orbit';
        r.transition = null;
      }
      const deltas = input.consume();
      const moved = deltas.rotateX || deltas.rotateY || deltas.panX || deltas.panY || deltas.zoom;
      const phase = tourPhase(r.tour.stops.length, now - r.tour.startedAt);
      if (moved || !phase) {
        useTourStore.getState().stop();
      } else {
        if (phase.index !== r.tour.index) {
          r.tour.index = phase.index;
          r.tour.flightFrom = r.lastPose;
          useSelectionStore.getState().select(r.tour.stops[phase.index]!.selectId);
        }
        const stop = r.tour.stops[phase.index]!;
        const sunId = catalog.bodies.find((b) => b.category === 'star')?.id;
        const bodyKm = ctx.bodyPosition(stop.targetId) ?? [0, 0, 0];
        const sunKm = (sunId && ctx.bodyPosition(sunId)) || [0, 0, 0];
        const az = (stop.targetId === sunId ? -90 * DEG : litAzimuth(bodyKm, sunKm)) + (phase.phase === 'dwell' ? phase.t * TOUR.dwellS * TOUR.orbitRadPerS : 0);
        const target = stopPose(stop, ctx, az);
        if (target) {
          const pose = phase.phase === 'flight' && r.tour.flightFrom && !prefersReducedMotion() ? interpolatePose(r.tour.flightFrom, target, phase.t) : target;
          r.lastPose = pose;
          frame.cameraPositionKm = pose.positionKm;
          camera.position.set(0, 0, 0);
          camera.quaternion.setFromRotationMatrix(writeMatrix4(lookRotation(pose.positionKm, pose.lookAtKm, pose.up), matrix));
          return;
        }
      }
    }
    if (r.tour) {
      // Tour ended (input, completion or toggle): hand control back to Orbit around the current stop, from where we are.
      const current = r.tour.stops[Math.max(0, r.tour.index)];
      r.orbit.enter(r.lastPose, ctx, current?.targetId);
      r.activeView = 'orbit';
      useViewStore.getState().setView('orbit');
      r.tour = null;
      r.transition = null;
    }
    const { view, coRotate, focusRequest } = useViewStore.getState();
    const selectedId = useSelectionStore.getState().selectedId;
    const startTransition = () => {
      if (r.lastPose) r.transition = { from: r.lastPose, startedAt: now };
    };

    if (view !== r.activeView) {
      if (view === 'follow') r.follow.enter(r.lastPose, ctx, selectedId ?? r.orbit.getState().targetId);
      else r.orbit.enter(r.lastPose, ctx, r.follow.getState().targetId);
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
    camera.quaternion.setFromRotationMatrix(writeMatrix4(lookRotation(pose.positionKm, pose.lookAtKm, pose.up), matrix));
  }, -1);

  return null;
}
