import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useEffect, useRef } from 'react';
import { CameraSystem } from '../camera/CameraSystem';
import type { Catalog } from '../core/catalog/catalog';
import type { Body, PlanetApproxOrbit, SatelliteOrbit } from '../core/catalog/schema';
import { BodyMesh } from './BodyMesh';
import { EffectsStack } from '../render/EffectsStack';
import { FrameDriver } from './FrameDriver';
import { FrameStateProvider } from './FrameStateContext';
import { LabelLayerContext } from './LabelLayerContext';
import { OrbitLine } from './OrbitLine';
import { SatelliteOrbitLine } from './SatelliteOrbitLine';
import { SkyBackground } from './sky/SkyBackground';
import { canvasDpr } from '../render/quality';
import { useRenderStore } from '../state/renderStore';
import { QualityGovernor } from '../render/QualityGovernor';
import { RenderStateAttributes } from '../render/RenderStateAttributes';
import { TextureReadiness } from './TextureReadiness';
import { useSkyStore } from '../state/skyStore';
import { useSceneStatsStore } from '../state/sceneStatsStore';
import { useFrameState } from './FrameStateContext';
import { useLabelDeclutter } from '../ui/useLabelDeclutter';

const hasApproxOrbit = (b: Body): b is Body & { orbit: PlanetApproxOrbit } => b.orbit.type === 'planet-approx';

const hasSatelliteOrbit = (b: Body): b is Body & { orbit: SatelliteOrbit } => b.orbit.type === 'satellite';

/** Publishes how many bodies are on screen at about 2 Hz (NDC in [-1, 1]^2, in front of the camera). */
function BodiesInView() {
  const frame = useFrameState();
  const camera = useThree((s) => s.camera);
  const scratch = useRef(new Vector3());
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.5) return;
    elapsed.current = 0;
    camera.updateMatrixWorld();
    const v = scratch.current;
    const cam = frame.cameraPositionKm;
    let count = 0;
    for (const p of frame.bodyPositionsKm.values()) {
      v.set(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]);
      v.applyMatrix4(camera.matrixWorldInverse);
      if (v.z >= 0) continue;
      v.applyMatrix4(camera.projectionMatrix);
      if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) count += 1;
    }
    useSceneStatsStore.getState().setBodiesInView(count);
  });
  return null;
}

export function SceneRoot({ catalog }: { catalog: Catalog }) {
  const level = useRenderStore((s) => s.level);
  const labelLayer = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  useLabelDeclutter(labelLayer);
  const loadSky = useSkyStore((s) => s.load);
  useEffect(() => {
    if (useSkyStore.getState().status === 'idle') void loadSky();
  }, [loadSky]);
  return (
    <div className="scene" ref={sceneRef}>
      <Canvas
        // The composer multisamples its own buffers; an MSAA backbuffer would cost memory and a resolve for nothing.
        gl={{ logarithmicDepthBuffer: true, antialias: false }}
        camera={{ fov: 50, near: 0.001, far: 1e13, position: [0, 0, 0] }}
        dpr={canvasDpr(level, typeof window === 'undefined' ? 1 : window.devicePixelRatio)}
      >
        <color attach="background" args={['#03050b']} />
        <LabelLayerContext.Provider value={labelLayer}>
          <FrameStateProvider>
            <SkyBackground />
            <FrameDriver catalog={catalog} />
            <CameraSystem catalog={catalog} />
            <QualityGovernor />
            <BodiesInView />
            {catalog.bodies.map((body) => (
              <BodyMesh key={body.id} body={body} bodies={catalog.bodies} />
            ))}
            {catalog.bodies.filter(hasApproxOrbit).map((body) => (
              <OrbitLine key={`orbit-${body.id}`} body={body} />
            ))}
            {catalog.bodies.filter(hasSatelliteOrbit).map((body) => (
              <SatelliteOrbitLine key={`orbit-${body.id}`} body={body} catalog={catalog} />
            ))}
            <EffectsStack bodies={catalog.bodies} />
          </FrameStateProvider>
        </LabelLayerContext.Provider>
      </Canvas>
      <TextureReadiness target={sceneRef} />
      <RenderStateAttributes target={sceneRef} />
      <div className="label-layer" ref={labelLayer} />
    </div>
  );
}
