import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial } from 'three';
import type { Catalog } from '../core/catalog/catalog';
import type { Body, SatelliteOrbit } from '../core/catalog/schema';
import { satelliteGeocentricKm } from '../core/ephemeris/system';
import type { Vec3 } from '../core/math/vec3';
import { useFrameState } from './FrameStateContext';

const POINTS = 180;
/** Re-sample the path when the date has moved this far (days). */
const RESAMPLE_DAYS = 0.25;

/**
 * The satellite's real path around its parent over one sidereal period centred on now, from the same ephemeris as the body.
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
      const period = body.orbit.meanElements.siderealPeriodDays;
      for (let i = 0; i < POINTS; i++) {
        const jd = frame.jdTdb - period / 2 + (period * i) / (POINTS - 1);
        const r: Vec3 = satelliteGeocentricKm(body.orbit, catalog.ephemerisTables, body.id, jd).r;
        path[i * 3] = r[0];
        path[i * 3 + 1] = r[1];
        path[i * 3 + 2] = r[2];
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
