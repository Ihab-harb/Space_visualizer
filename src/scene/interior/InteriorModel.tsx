import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CircleGeometry, Matrix4, Quaternion, Ray, SphereGeometry, Vector3, type Group, type Intersection, type Mesh, type Raycaster } from 'three';
import type { Body } from '../../core/catalog/schema';
import { apply, transpose } from '../../core/math/mat3';
import { add, normalize, scale, sub, type Vec3 } from '../../core/math/vec3';
import { PRESETS } from '../../render/quality';
import { readyDetails, useBodyDetails } from '../../state/detailsStore';
import { useExploreStore } from '../../state/exploreStore';
import { useRenderStore } from '../../state/renderStore';
import { useFrameState } from '../FrameStateContext';
import { writeMatrix4 } from '../threeMath';
import { rayHitShell } from './exploreFrame';
import { createInteriorMaterial, createSharedUniforms, writeLayerTable } from './interiorMaterial';
import { interiorKind } from './interiorPalette';
import { drawnForDetails } from './useExploreTransition';

const CLICK_DRAG_TOLERANCE_PX = 4;
const Z: Vector3 = new Vector3(0, 0, 1);

/**
 * The explored body's interior (spec §6), drawn inside BodyMesh's group. Each layer is a group at its explode offset,
 * oriented with the body (rotation frozen at entry) and scaled to body radii. It holds the layer's cut face (a disc on the
 * cut plane, coloured by radius), its outer surface and the inside of its hollow. Layer 0's outer surface is the body's
 * own mesh (cut by the same plane in createBodyMaterial). Everything reads `frame.explore`.
 */
export function InteriorModel({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const frame = useFrameState();
  const entry = useBodyDetails(body.id);
  const details = readyDetails(entry);
  const drawn = useMemo(() => drawnForDetails(body, details), [body, details]);
  const kind = interiorKind(body);
  const sunId = useMemo(() => bodies.find((b) => b.category === 'star')?.id, [bodies]);
  const [widthSegments, heightSegments] = useRenderStore((s) => PRESETS[s.level].sphereSegments);
  const sphere = useMemo(() => {
    const g = new SphereGeometry(1, widthSegments, heightSegments);
    g.rotateX(Math.PI / 2);
    return g;
  }, [widthSegments, heightSegments]);
  const disc = useMemo(() => new CircleGeometry(1, widthSegments), [widthSegments]);
  useEffect(() => () => sphere.dispose(), [sphere]);
  useEffect(() => () => disc.dispose(), [disc]);
  const shared = useMemo(createSharedUniforms, []);
  useEffect(() => writeLayerTable(shared, drawn, kind), [shared, drawn, kind]);
  const parts = useMemo(
    () =>
      drawn.map((layer, i) => ({
        face: createInteriorMaterial('face', shared, i),
        shell: i > 0 ? createInteriorMaterial('shell', shared, i) : null,
        hollow: i < drawn.length - 1 && layer.inner > 0 ? createInteriorMaterial('hollow', shared, i) : null,
      })),
    [drawn, shared],
  );
  useEffect(
    () => () => {
      for (const p of parts) {
        p.face.dispose();
        p.shell?.dispose();
        p.hollow?.dispose();
      }
    },
    [parts],
  );

  const root = useRef<Group>(null);
  const groups = useRef<Array<Group | null>>([]);
  const faces = useRef<Array<Mesh | null>>([]);
  const shells = useRef<Array<Mesh | null>>([]);
  const hollows = useRef<Array<Mesh | null>>([]);
  const scratch = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), faceQ: new Quaternion(), n: new Vector3(), inv: new Matrix4(), ray: new Ray() }), []);

  useFrame((state) => {
    const ex = frame.explore;
    const group = root.current;
    if (!group) return;
    const open = !!ex && ex.bodyId === body.id && ex.progress > 0 && ex.drawn === drawn && drawn.length > 0;
    group.visible = open;
    if (!open || !ex) return;
    const pos = frame.bodyPositionsKm.get(body.id);
    const R = frame.bodyRenderRadiusKm.get(body.id);
    const orientation = frame.bodyOrientation.get(body.id);
    if (!pos || !R) return;
    const toObj = orientation ? transpose(orientation) : null;
    const obj = (v: Vec3): Vec3 => (toObj ? apply(toObj, v) : v);
    if (orientation) scratch.q.setFromRotationMatrix(writeMatrix4(orientation, scratch.m));
    else scratch.q.identity();
    const sunPos = sunId ? frame.bodyPositionsKm.get(sunId) : undefined;
    const sunDir = sunPos && sunId !== body.id ? obj(normalize(sub(sunPos, pos))) : obj(normalize(sub(frame.cameraPositionKm, pos)));
    shared.uSunDirObj!.value.set(...sunDir);
    // The Sun's own interior is lit from inside: no sunlight term.
    shared.uSunLight!.value = sunId === body.id ? 0 : 1;
    shared.uPlane!.value.set(...ex.planeNormalObj);
    shared.uPlaneOffset!.value = ex.planeOffset;
    shared.uFlattening!.value = body.shape.polarRadiusKm / body.shape.equatorialRadiusKm;
    shared.uTime!.value = state.clock.elapsedTime;
    shared.uSelected!.value = ex.selectedLayerId ? drawn.findIndex((l) => l.id === ex.selectedLayerId) : -1;
    const n = scratch.n.set(...ex.planeNormalObj);
    const faceQuat = scratch.faceQ.setFromUnitVectors(Z, n);
    const rel = sub(pos, frame.cameraPositionKm);
    const last = drawn.length - 1;
    const cutOn = ex.planeOffset < 1;
    const exploded = ex.view === 'exploded';
    drawn.forEach((layer, i) => {
      const g = groups.current[i];
      if (!g) return;
      const lift = ex.offsets[i] ?? 0;
      const offset = scale(ex.upWorld, lift * R);
      g.position.set(...offset);
      g.quaternion.copy(scratch.q);
      g.scale.setScalar(R);
      const cam = obj(scale(add(rel, offset), -1 / R));
      const cutsThis = cutOn && (i < last || ex.cutsInnermost);
      const face = faces.current[i];
      if (face) {
        face.visible = cutsThis;
        face.position.copy(n).multiplyScalar(ex.planeOffset);
        face.quaternion.copy(faceQuat);
        face.scale.setScalar(layer.outer);
        const m = parts[i]!.face;
        m.uniforms.uRange!.value.set(i === last ? 0 : layer.inner, layer.outer);
        m.uniforms.uLocal!.value = face.matrix;
      }
      const shell = shells.current[i];
      if (shell) {
        shell.visible = exploded;
        shell.scale.set(layer.outer, layer.outer, layer.outer * shared.uFlattening!.value);
        const m = parts[i]!.shell!;
        m.uniforms.uLocal!.value = shell.matrix;
        m.uniforms.uCamObj!.value.set(...cam);
        m.uniforms.uClipOn!.value = i < last ? 1 : 0;
      }
      const hollow = hollows.current[i];
      if (hollow) {
        hollow.visible = exploded && cutOn;
        hollow.scale.set(layer.inner, layer.inner, layer.inner * shared.uFlattening!.value);
        const m = parts[i]!.hollow!;
        m.uniforms.uLocal!.value = hollow.matrix;
        m.uniforms.uCamObj!.value.set(...cam);
      }
    });
  }, -0.4);

  /** Analytic picking for layer i: its cut face, its outer surface (layer 0: the body's own shell) or its hollow. */
  const raycastFor = (i: number) =>
    function raycast(this: Mesh, raycaster: Raycaster, intersects: Intersection[]) {
      const ex = frame.explore;
      const g = groups.current[i];
      const layer = drawn[i];
      if (!ex || ex.bodyId !== body.id || ex.progress <= 0 || !g || !layer) return;
      const R = g.scale.x;
      scratch.inv.copy(g.matrixWorld).invert();
      scratch.ray.copy(raycaster.ray).applyMatrix4(scratch.inv);
      const o: Vec3 = [scratch.ray.origin.x, scratch.ray.origin.y, scratch.ray.origin.z];
      const d: Vec3 = normalize([scratch.ray.direction.x, scratch.ray.direction.y, scratch.ray.direction.z]);
      const last = drawn.length - 1;
      const cut = ex.planeOffset < 1 && (i < last || ex.cutsInnermost);
      // In Half-section only the faces show; an inner layer's outer surface is hidden behind them.
      if (ex.view === 'section' && i > 0 && !cut) return;
      const t = rayHitShell(o, d, { outer: layer.outer, inner: i === last ? 0 : layer.inner }, cut ? { normal: ex.planeNormalObj, offset: ex.planeOffset } : null);
      if (t === null) return;
      const point = raycaster.ray.at(t * R, new Vector3());
      intersects.push({ distance: t * R, point, object: this });
    };

  const selectLayer = useExploreStore((s) => s.selectLayer);
  const onClick = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_DRAG_TOLERANCE_PX) return;
    selectLayer(id);
  };

  return (
    <group ref={root} visible={false}>
      {drawn.map((layer, i) => (
        <group key={layer.id} ref={(g) => void (groups.current[i] = g)}>
          <mesh
            ref={(m) => void (faces.current[i] = m)}
            geometry={disc}
            material={parts[i]!.face}
            frustumCulled={false}
            raycast={raycastFor(i)}
            onClick={onClick(layer.id)}
          />
          {parts[i]!.shell && <mesh ref={(m) => void (shells.current[i] = m)} geometry={sphere} material={parts[i]!.shell!} frustumCulled={false} raycast={() => undefined} />}
          {parts[i]!.hollow && <mesh ref={(m) => void (hollows.current[i] = m)} geometry={sphere} material={parts[i]!.hollow!} frustumCulled={false} raycast={() => undefined} />}
        </group>
      ))}
    </group>
  );
}
