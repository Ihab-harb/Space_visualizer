import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Matrix4, Mesh as ThreeMesh, SphereGeometry, type Group, type Mesh } from 'three';
import type { Body } from '../core/catalog/schema';
import { cross, dot, length, sub } from '../core/math/vec3';
import { PRESETS } from '../render/quality';
import { useRenderStore } from '../state/renderStore';
import { clearFeatureOnEmptyClick } from '../state/exploreStore';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore } from '../state/viewStore';
import { BodyLabel } from './BodyLabel';
import { useFrameState } from './FrameStateContext';
import { BodyExtras, BodyMaterial } from './materials/BodyMaterial';
import { minPixelsFor, pixelsPerRadian, renderRadiusKm } from './scaleMode';
import { isInflated, satelliteHidden } from './satelliteVisibility';
import { writeMatrix4 } from './threeMath';
import { bodyPickable } from './interior/exploreFrame';
import { InteriorModel } from './interior/InteriorModel';
import { useInteriorSession } from './interior/useExploreTransition';

const noRaycast = () => undefined;
const CLICK_DRAG_TOLERANCE_PX = 4;
/**
 * After CameraSystem (-1), before drei <Html> labels (0). drei caches the first projected label position;
 * if it runs while this group is still at the origin (= camera position) it caches NaN and never moves the label.
 */
const POSITION_PRIORITY = -0.5;

export function BodyMesh({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const frame = useFrameState();
  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const matrix = useMemo(() => new Matrix4(), []);
  const isStar = body.category === 'star';
  // A satellite of a planet is hidden while it sits inside the planet's drawn disc, but only when readable-scale
  // inflation causes the overlap (spec §6). With true radii on both bodies it is never hidden.
  const parent = useMemo(() => {
    const p = body.parentId ? bodies.find((b) => b.id === body.parentId) : undefined;
    return p && p.category !== 'star' ? p : undefined;
  }, [body.parentId, bodies]);
  const [widthSegments, heightSegments] = useRenderStore((s) => PRESETS[s.level].sphereSegments);
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, widthSegments, heightSegments);
    g.rotateX(Math.PI / 2); // Three's sphere poles are on +Y; body-fixed poles are on +Z
    return g;
  }, [widthSegments, heightSegments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const select = useSelectionStore((s) => s.select);
  const hover = useSelectionStore((s) => s.hover);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const explored = useInteriorSession((s) => s.bodyId === body.id);

  useFrame(() => {
    const position = frame.bodyPositionsKm.get(body.id);
    if (!position || !group.current || !mesh.current) return;
    const rel = sub(position, frame.cameraPositionKm);
    group.current.position.set(rel[0], rel[1], rel[2]);
    const { equatorialRadiusKm, polarRadiusKm } = body.shape;
    const scaleMode = useViewStore.getState().scaleMode;
    const pxPerRad = pixelsPerRadian(frame.viewportHeightPx, frame.fovRad);
    const distanceKm = length(rel);
    const radius = renderRadiusKm(equatorialRadiusKm, distanceKm, scaleMode, minPixelsFor(body.category), pxPerRad);
    frame.bodyRenderRadiusKm.set(body.id, radius);
    const parentPosition = parent && frame.bodyPositionsKm.get(parent.id);
    if (parent && parentPosition) {
      // Computed inline (not from frame.bodyRenderRadiusKm) so the result does not depend on which BodyMesh runs first.
      const parentRel = sub(parentPosition, frame.cameraPositionKm);
      const parentDistance = length(parentRel);
      const parentRadius = renderRadiusKm(parent.shape.equatorialRadiusKm, parentDistance, scaleMode, minPixelsFor(parent.category), pxPerRad);
      const separationPx = Math.atan2(length(cross(rel, parentRel)), dot(rel, parentRel)) * pxPerRad;
      const shown = !satelliteHidden({
        separationPx,
        parentRadiusPx: (parentRadius / Math.max(parentDistance, 1e-9)) * pxPerRad,
        selfRadiusPx: (radius / Math.max(distanceKm, 1e-9)) * pxPerRad,
        selfInflated: isInflated(radius, equatorialRadiusKm),
        parentInflated: isInflated(parentRadius, parent.shape.equatorialRadiusKm),
      });
      if (shown) frame.bodyHidden.delete(body.id);
      else frame.bodyHidden.add(body.id);
      group.current.visible = shown;
    }
    // Explore: the outer shell lifts with the outermost layer; while the body is open the interior model does the picking
    // (this sphere's own raycast would hit the cut-away part), and no other body takes clicks.
    const ex = frame.explore?.bodyId === body.id ? frame.explore : null;
    const lift = ex ? (ex.offsets[0] ?? 0) * radius : 0;
    mesh.current.position.set(ex ? ex.upWorld[0] * lift : 0, ex ? ex.upWorld[1] * lift : 0, ex ? ex.upWorld[2] * lift : 0);
    const pickable = bodyPickable(frame.explore, body.id, !parent || !frame.bodyHidden.has(body.id));
    mesh.current.raycast = pickable ? ThreeMesh.prototype.raycast : noRaycast;
    const k = radius / equatorialRadiusKm;
    mesh.current.scale.set(equatorialRadiusKm * k, equatorialRadiusKm * k, polarRadiusKm * k);
    const orientation = frame.bodyOrientation.get(body.id);
    if (orientation) mesh.current.quaternion.setFromRotationMatrix(writeMatrix4(orientation, matrix));
  }, POSITION_PRIORITY);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE_PX) return; // this was a camera drag, not a click
    // In Explore only the explored body takes clicks: a click on it, off the pins, clears the selected feature.
    clearFeatureOnEmptyClick();
    select(body.id);
  };

  return (
    <group ref={group}>
      <mesh
        ref={mesh}
        geometry={geometry}
        onClick={onClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          requestFocus(body.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hover(body.id);
        }}
        onPointerOut={() => hover(null)}
      >
        <BodyMaterial body={body} bodies={bodies} />
        <BodyExtras body={body} bodies={bodies} />
      </mesh>
      {explored && <InteriorModel body={body} bodies={bodies} />}
      <BodyLabel body={body} sunId={bodies.find((b) => b.category === 'star')?.id} />
    </group>
  );
}
