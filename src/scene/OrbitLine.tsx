import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial } from 'three';
import type { Body, PlanetApproxOrbit } from '../core/catalog/schema';
import { orbitPolylineKm } from '../core/ephemeris/conic';
import { solveKeplerElliptic } from '../core/ephemeris/kepler';
import { elementsAt, selectTable } from '../core/ephemeris/planetApprox';
import { useFrameState } from './FrameStateContext';

const SEGMENTS = 360;

/** Rebuilt every frame relative to the camera, so the line stays precise next to the planet. */
export function OrbitLine({ body }: { body: Body & { orbit: PlanetApproxOrbit } }) {
  const frame = useFrameState();
  const positions = useMemo(() => new Float32Array((SEGMENTS + 1) * 3), []);
  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const l = new Line(geometry, new LineBasicMaterial({ color: body.display.color, transparent: true, opacity: 0.45 }));
    l.frustumCulled = false;
    return l;
  }, [positions, body.display.color]);

  useFrame(() => {
    const { table } = selectTable(body.orbit.tables, frame.jdTdb);
    const el = elementsAt(table, frame.jdTdb);
    const points = orbitPolylineKm(el, solveKeplerElliptic(el.meanAnomalyRad, el.e), SEGMENTS);
    const c = frame.cameraPositionKm;
    points.forEach((p, i) => {
      positions[i * 3] = p[0] - c[0];
      positions[i * 3 + 1] = p[1] - c[1];
      positions[i * 3 + 2] = p[2] - c[2];
    });
    line.geometry.attributes.position!.needsUpdate = true;
  });

  return <primitive object={line} />;
}
