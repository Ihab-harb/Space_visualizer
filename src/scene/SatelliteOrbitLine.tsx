import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial } from 'three';
import type { Catalog } from '../core/catalog/catalog';
import type { Body, SatelliteOrbit } from '../core/catalog/schema';
import { satelliteOrbitPathKm } from '../core/ephemeris/system';
import { useFrameState } from './FrameStateContext';

const POINTS = 180;
/** Re-sample the path when the date has moved this far (days). */
const RESAMPLE_DAYS = 0.25;

/**
 * The satellite's real path around its parent over one sidereal period around now, sampled with the one model in force at the current date (no kink at the table edge).
 * Stored parent-relative (km); placed around the parent's current position, minus the camera, every frame.
 */
export function SatelliteOrbitLine({ body, catalog }: { body: Body & { orbit: SatelliteOrbit }; catalog: Catalog }) {
  const frame = useFrameState();
  const positions = useMemo(() => new Float32Array(POINTS * 3), []);
  const path = useMemo(() => new Float64Array(POINTS * 3), []);
  const sampledAt = useRef(Number.NaN);
  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const l = new Line(geometry, new LineBasicMaterial({ color: body.display.color, transparent: true, opacity: 0.45 }));
    l.frustumCulled = false;
    return l;
  }, [positions, body.display.color]);
  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as LineBasicMaterial).dispose();
  }, [line]);

  useFrame(() => {
    const parentPos = body.parentId ? frame.bodyPositionsKm.get(body.parentId) : undefined;
    if (!parentPos) return;
    const hidden = frame.bodyHidden.has(body.id);
    line.visible = !hidden;
    if (hidden) return;
    if (!(Math.abs(frame.jdTdb - sampledAt.current) <= RESAMPLE_DAYS)) {
      const sampled = satelliteOrbitPathKm(body.orbit, catalog.ephemerisTables, body.id, frame.jdTdb, POINTS);
      for (let i = 0; i < POINTS; i++) {
        path[i * 3] = sampled[i]![0];
        path[i * 3 + 1] = sampled[i]![1];
        path[i * 3 + 2] = sampled[i]![2];
      }
      sampledAt.current = frame.jdTdb;
    }
    const c = frame.cameraPositionKm;
    for (let i = 0; i < POINTS; i++) {
      positions[i * 3] = parentPos[0] + path[i * 3]! - c[0];
      positions[i * 3 + 1] = parentPos[1] + path[i * 3 + 1]! - c[1];
      positions[i * 3 + 2] = parentPos[2] + path[i * 3 + 2]! - c[2];
    }
    line.geometry.attributes.position!.needsUpdate = true;
  });

  return <primitive object={line} />;
}
