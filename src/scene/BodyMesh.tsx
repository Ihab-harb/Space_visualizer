import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Matrix4, SphereGeometry, type Group, type Mesh } from 'three';
import type { Body } from '../core/catalog/schema';
import { length, sub } from '../core/math/vec3';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore } from '../state/viewStore';
import { BodyLabel } from './BodyLabel';
import { useFrameState } from './FrameStateContext';
import { MIN_PIXELS, pixelsPerRadian, renderRadiusKm } from './scaleMode';
import { writeMatrix4 } from './threeMath';

const CLICK_DRAG_TOLERANCE_PX = 4;

export function BodyMesh({ body }: { body: Body }) {
  const frame = useFrameState();
  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const matrix = useMemo(() => new Matrix4(), []);
  const isStar = body.category === 'star';
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 64, 32);
    g.rotateX(Math.PI / 2); // Three's sphere poles are on +Y; body-fixed poles are on +Z
    return g;
  }, []);
  const starColor = useMemo(() => new Color(body.display.color).multiplyScalar(2.2), [body.display.color]);
  const select = useSelectionStore((s) => s.select);
  const hover = useSelectionStore((s) => s.hover);
  const requestFocus = useViewStore((s) => s.requestFocus);

  useFrame(() => {
    const position = frame.bodyPositionsKm.get(body.id);
    if (!position || !group.current || !mesh.current) return;
    const rel = sub(position, frame.cameraPositionKm);
    group.current.position.set(rel[0], rel[1], rel[2]);
    const { equatorialRadiusKm, polarRadiusKm } = body.shape;
    const radius = renderRadiusKm(
      equatorialRadiusKm,
      length(rel),
      useViewStore.getState().scaleMode,
      isStar ? MIN_PIXELS.star : MIN_PIXELS.body,
      pixelsPerRadian(frame.viewportHeightPx, frame.fovRad),
    );
    const k = radius / equatorialRadiusKm;
    mesh.current.scale.set(equatorialRadiusKm * k, equatorialRadiusKm * k, polarRadiusKm * k);
    const orientation = frame.bodyOrientation.get(body.id);
    if (orientation) mesh.current.quaternion.setFromRotationMatrix(writeMatrix4(orientation, matrix));
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE_PX) return; // this was a camera drag, not a click
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
        {isStar ? (
          <meshBasicMaterial color={starColor} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={body.display.color} roughness={1} metalness={0} />
        )}
      </mesh>
      <BodyLabel body={body} />
    </group>
  );
}
