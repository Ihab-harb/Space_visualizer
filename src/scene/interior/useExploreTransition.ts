import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { Catalog } from '../../core/catalog/catalog';
import type { Body } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import { drawnLayers, explodeOffsets, type DrawnLayer } from '../../core/interior/geometry';
import { apply, transpose, type Mat3 } from '../../core/math/mat3';
import { scale, type Vec3 } from '../../core/math/vec3';
import { useDetailsStore } from '../../state/detailsStore';
import { useExploreStore } from '../../state/exploreStore';
import { useFrameState } from '../FrameStateContext';
import { cutAmounts, drawnExtent, sectionNormal, SECTION_YAW_RAD } from './exploreFrame';
import { CLOSED, easeInOut, stepTransition, type TransitionState } from './exploreTransition';

/** After CameraSystem (-1), so the camera's capture is current; before BodyMesh (-0.5) and the body uniforms (-0.4). */
export const EXPLORE_PRIORITY = -0.9;

/** The body whose interior is mounted. Changes only when a session starts, switches body or ends (not every frame). */
export const useInteriorSession = create<{ bodyId: string | null }>()(() => ({ bodyId: null }));

const drawnCache = new WeakMap<BodyDetails, DrawnLayer[]>();

/** The body's mean radius: the radius its cited layer bounds are measured against (as the details build does). */
export function interiorRadiusKm(body: Body): number {
  const mean = body.facts.meanRadiusKm?.value;
  return typeof mean === 'number' && mean > 0 ? mean : body.shape.equatorialRadiusKm;
}

/** Drawn layers for loaded details, cached per details object so the scene parts and the labels share one array. */
export function drawnForDetails(body: Body, details: BodyDetails | null): DrawnLayer[] {
  if (!details?.interior) return [];
  let drawn = drawnCache.get(details);
  if (!drawn) {
    drawn = drawnLayers(details.interior.layers, interiorRadiusKm(body));
    drawnCache.set(details, drawn);
  }
  return drawn;
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Drives Explore in the scene each frame: steps the transition, freezes the explored body's orientation, captures the
 * explode axis and the Half-section plane, and publishes `frame.explore` (see exploreFrame.ts) and the store's progress.
 */
export function useExploreTransition(catalog: Catalog): void {
  const frame = useFrameState();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__svExplore = () => frame.explore;
    return () => {
      delete window.__svExplore;
    };
  }, [frame]);
  const state = useRef<TransitionState>(CLOSED);
  const session = useRef<{ bodyId: string; frozen: Mat3 | null; up: Vec3; sectionNormal: Vec3 } | null>(null);

  useFrame((_, delta) => {
    const ex = useExploreStore.getState();
    const detailsEntry = ex.bodyId ? useDetailsStore.getState().entries[ex.bodyId] : undefined;
    if (ex.active && ex.bodyId && !detailsEntry) void useDetailsStore.getState().load(ex.bodyId);
    const activeBody = ex.bodyId ? catalog.bodyById.get(ex.bodyId) : undefined;
    const activeDrawn = activeBody && detailsEntry?.status === 'ready' ? drawnForDetails(activeBody, detailsEntry.details) : [];
    const prev = state.current;
    const next = stepTransition(
      prev,
      { active: ex.active, bodyId: ex.bodyId, view: ex.view, sectionSeq: ex.sectionSeq, reducedMotion: prefersReducedMotion(), ready: activeDrawn.length > 0 },
      delta,
    );
    state.current = next;

    if (next.bodyId !== prev.bodyId) {
      session.current = next.bodyId
        ? {
            bodyId: next.bodyId,
            frozen: frame.bodyOrientation.get(next.bodyId) ?? null,
            up: frame.exploreCamera?.upWorld ?? [0, 0, 1],
            sectionNormal: [0, 0, 1],
          }
        : null;
      useInteriorSession.setState({ bodyId: next.bodyId });
    }
    const s = session.current;
    const body = next.bodyId ? catalog.bodyById.get(next.bodyId) : undefined;
    if (!s || !body) {
      frame.explore = null;
      return;
    }
    // Rotation frozen at entry: everything after this point (meshes, shading, labels) sees the orientation of the entry frame.
    if (s.frozen) frame.bodyOrientation.set(s.bodyId, s.frozen);
    const entry = useDetailsStore.getState().entries[s.bodyId];
    const drawn = entry?.status === 'ready' ? drawnForDetails(body, entry.details) : [];

    const openedSection = next.view === 'section' && (prev.view !== 'section' || prev.sectionSeq !== next.sectionSeq || prev.bodyId !== next.bodyId);
    if (openedSection) s.sectionNormal = sectionNormal(frame.exploreCamera?.toCameraWorld ?? s.up, s.up, SECTION_YAW_RAD);

    const progress = easeInOut(next.t);
    const focus = easeInOut(next.focus);
    const { cut, explode } = cutAmounts(next.view, progress);
    const offsets = explodeOffsets(drawn, explode);
    const normalWorld = next.view === 'section' ? s.sectionNormal : scale(s.up, -1);
    const toObj = s.frozen ? transpose(s.frozen) : null;
    const obj = (v: Vec3): Vec3 => (toObj ? apply(toObj, v) : v);
    const extent = next.view === 'exploded' ? drawnExtent(drawn, offsets, cut) : { bottom: -1, top: 1 };
    frame.explore = {
      bodyId: s.bodyId,
      view: next.view,
      progress,
      focus,
      drawn,
      offsets,
      upWorld: s.up,
      upObj: obj(s.up),
      planeNormalWorld: normalWorld,
      planeNormalObj: obj(normalWorld),
      planeOffset: cut > 0 ? 1 - cut : 2,
      cutsInnermost: next.view === 'section',
      shiftRadii: (extent.bottom + extent.top) / 2,
      selectedLayerId: ex.active && ex.bodyId === s.bodyId ? ex.selectedLayerId : null,
    };
    if (ex.active && ex.bodyId === s.bodyId && Math.abs(ex.progress - progress) > 1e-4) ex.setProgress(progress);
  }, EXPLORE_PRIORITY);
}

/** Mounts the Explore driver inside the Canvas. */
export function ExploreDriver({ catalog }: { catalog: Catalog }) {
  useExploreTransition(catalog);
  return null;
}
