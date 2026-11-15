import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Matrix4 } from 'three';
import type { Catalog } from '../core/catalog/catalog';
import { DEG } from '../core/math/angles';
import { useFrameState } from '../scene/FrameStateContext';
import type { FrameState } from '../scene/frameState';
import { writeMatrix4 } from '../scene/threeMath';
import { useExploreStore } from '../state/exploreStore';
import { useSelectionStore } from '../state/selectionStore';
import { add, scale, sub } from '../core/math/vec3';
import { advanceTurn, EXPLORE_CAMERA, exploreEntryAzimuth, exploreFitScale, exploreFrameRadii, exploreInput, featureView, orbitUp, reframeDistanceKm, type FeatureTurn } from './explore';
import { apply } from '../core/math/mat3';
import { surfaceDirection } from '../core/frames/surfacePoint';
import { useDetailsStore } from '../state/detailsStore';
import { featureEntry } from '../ui/explore/featureModel';
import { NO_INPUT } from './types';
import { offsetDirection, type OrbitState } from './orbitController';
import { useTourStore } from '../state/tourStore';
import { useViewStore, type ViewId } from '../state/viewStore';
import { createFollowController, type FollowState } from './followController';
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
  /** Explore: the pose found on entry (restored on leave) and the explode axis captured then. */
  explore: { bodyId: string; up: [number, number, number]; aspect: number; turn: FeatureTurn | null; lastFeatureSeq: number; saved: { view: ViewId; orbit: OrbitState; follow: FollowState } } | null;
}

/** The selected feature's position (a landmark or a Gazetteer feature). Null until the body's details have loaded or if the id is unknown. */
function featureLatLon(bodyId: string, featureId: string): { latDeg: number; lonDegE: number } | null {
  const entry = useDetailsStore.getState().entries[bodyId];
  return featureEntry(entry?.status === 'ready' ? entry.details : null, featureId);
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
      explore: null,
    };
  }

  useFrame((state) => {
    const r = rig.current!;
    const ctx = makeContext(frame, catalog);
    const override = useViewStore.getState().cameraOverride;
    let overrideNow = false;
    if (override && override.seq !== r.lastOverrideSeq) {
      overrideNow = true;
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
      // The view store is left alone: a key 2 that ended the tour has already asked for Follow, and the normal path below enters it from this pose.
      r.activeView = 'orbit';
      r.tour = null;
      r.transition = null;
    }
    const { view, coRotate, focusRequest } = useViewStore.getState();
    const selectedId = useSelectionStore.getState().selectedId;
    const startTransition = () => {
      if (r.lastPose) r.transition = { from: r.lastPose, startedAt: now };
    };
    const exploreState = useExploreStore.getState();
    const exploreBody = exploreState.active ? exploreState.bodyId : null;
    if (exploreBody && (!r.explore || r.explore.bodyId !== exploreBody)) {
      // Entering Explore (or another body while in it): save the pose once, then frame the body from the current direction.
      const saved = r.explore?.saved ?? { view: r.activeView, orbit: r.orbit.getState(), follow: r.follow.getState() };
      if (r.orbit.getState().targetId !== exploreBody || r.activeView !== 'orbit') r.orbit.enter(r.lastPose, ctx, exploreBody);
      const st = r.orbit.getState();
      r.orbit.restore({ ...st, panOffsetKm: [0, 0, 0] });
      // A portrait phone frames from further back, so the body's whole width fits.
      const aspect = gl.domElement.clientWidth / Math.max(gl.domElement.clientHeight, 1);
      // Open on the sunlit side (the Sun itself keeps its direction).
      const sunId = catalog.bodies.find((b) => b.category === 'star')?.id ?? null;
      const azimuthRad = exploreEntryAzimuth(exploreBody, sunId, ctx.bodyPosition(exploreBody) ?? [0, 0, 0], (sunId && ctx.bodyPosition(sunId)) || [0, 0, 0], st.azimuthRad);
      r.orbit.setView({ distanceKm: ctx.bodyRadiusKm(exploreBody) * exploreFrameRadii(frame.fovRad, aspect), azimuthRad, elevationRad: st.elevationRad + EXPLORE_CAMERA.tiltRad });
      // lastFeatureSeq starts at 0: a selection always belongs to this session (enter clears it), even one made before the first frame.
      r.explore = { bodyId: exploreBody, up: orbitUp(azimuthRad, st.elevationRad) as [number, number, number], aspect, turn: null, lastFeatureSeq: 0, saved };
      r.activeView = 'orbit';
      // A URL that opens Explore starts there; any other entry flies.
      if (!overrideNow) startTransition();
    }
    if (r.explore) {
      if (!exploreBody && frame.explore === null) {
        // The interior has closed: put the camera back where it was before Explore.
        const { saved } = r.explore;
        r.orbit.restore(saved.orbit);
        r.follow.restore(saved.follow);
        r.activeView = saved.view;
        r.explore = null;
        frame.exploreCamera = null;
        startTransition();
      } else {
        const id = r.explore.bodyId;
        const radius = ctx.bodyRadiusKm(id);
        const aspectNow = gl.domElement.clientWidth / Math.max(gl.domElement.clientHeight, 1);
        if (Math.abs(aspectNow - r.explore.aspect) > 1e-3) {
          // The screen turned (or the window was resized): the framing for the new shape is a floor on the distance.
          r.orbit.setView({ distanceKm: reframeDistanceKm(r.orbit.getState().distanceKm, radius, frame.fovRad, r.explore.aspect, aspectNow) });
          r.explore.aspect = aspectNow;
        }
        // Orbit and zoom only: a pan would move the body off centre stage.
        const deltas = exploreInput(input.consume());
        r.orbit.update(deltas, ctx);
        // The turn to a selected feature (Surface tab only). Rotate or zoom input cancels it; that frame the user's input stands.
        if (exploreState.view !== 'whole') r.explore.turn = null;
        else if (exploreState.selectedFeatureId !== null && exploreState.featureSeq !== r.explore.lastFeatureSeq) {
          const latLon = featureLatLon(id, exploreState.selectedFeatureId);
          const orientation = frame.bodyOrientation.get(id);
          if (latLon && orientation) {
            const cur = r.orbit.getState();
            r.explore.turn = {
              from: { azimuthRad: cur.azimuthRad, elevationRad: cur.elevationRad },
              to: featureView(apply(orientation, surfaceDirection(latLon.latDeg, latLon.lonDegE))),
              startedAt: now,
              seq: exploreState.featureSeq,
            };
            r.explore.lastFeatureSeq = exploreState.featureSeq;
          }
        }
        const hasInput = deltas.rotateX !== 0 || deltas.rotateY !== 0 || deltas.zoom !== 0;
        const step = advanceTurn(r.explore.turn, now, hasInput, prefersReducedMotion());
        r.explore.turn = step.turn;
        if (step.view) r.orbit.setView(step.view);
        const st = r.orbit.getState();
        r.orbit.setView({ distanceKm: Math.min(st.distanceKm, radius * EXPLORE_CAMERA.maxRadii) });
        let pose = r.orbit.update(NO_INPUT, ctx);
        // Look at the middle of what is drawn (the exploded caps rise above the centre), and step back while the stack is
        // taller than the body, so the whole stack stays in frame with room for the labels.
        const shown = frame.explore?.bodyId === id ? frame.explore : null;
        if (shown) {
          const shift = scale(shown.upWorld, shown.shiftRadii * (frame.bodyRenderRadiusKm.get(id) ?? radius));
          const aspect = gl.domElement.clientWidth / Math.max(gl.domElement.clientHeight, 1);
          const fit = exploreFitScale(shown.halfHeightRadii, frame.fovRad, aspect);
          const back = scale(sub(pose.positionKm, pose.lookAtKm), fit - 1);
          pose = { ...pose, positionKm: add(add(pose.positionKm, shift), back), lookAtKm: add(pose.lookAtKm, shift) };
        }
        frame.exploreCamera = { upWorld: r.explore.up, toCameraWorld: offsetDirection(st.azimuthRad, st.elevationRad) };
        if (r.transition) {
          const s = prefersReducedMotion() ? 1 : (now - r.transition.startedAt) / TRANSITION_SECONDS;
          pose = interpolatePose(r.transition.from, pose, s);
          if (s >= 1) r.transition = null;
        }
        r.lastPose = pose;
        r.lastSelectedId = selectedId;
        frame.cameraPositionKm = pose.positionKm;
        camera.position.set(0, 0, 0);
        camera.quaternion.setFromRotationMatrix(writeMatrix4(lookRotation(pose.positionKm, pose.lookAtKm, pose.up), matrix));
        return;
      }
    }

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
