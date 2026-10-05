import { Canvas } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { CameraSystem } from '../camera/CameraSystem';
import type { Catalog } from '../core/catalog/catalog';
import type { Body, PlanetApproxOrbit } from '../core/catalog/schema';
import { BodyMesh } from './BodyMesh';
import { EffectsStack } from '../render/EffectsStack';
import { FrameDriver } from './FrameDriver';
import { FrameStateProvider } from './FrameStateContext';
import { LabelLayerContext } from './LabelLayerContext';
import { OrbitLine } from './OrbitLine';
import { SkyBackground } from './sky/SkyBackground';
import { canvasDpr } from '../render/quality';
import { useRenderStore } from '../state/renderStore';
import { QualityGovernor } from '../render/QualityGovernor';
import { RenderStateAttributes } from '../render/RenderStateAttributes';
import { TextureReadiness } from './TextureReadiness';
import { useSkyStore } from '../state/skyStore';

const hasApproxOrbit = (b: Body): b is Body & { orbit: PlanetApproxOrbit } => b.orbit.type === 'planet-approx';

export function SceneRoot({ catalog }: { catalog: Catalog }) {
  const level = useRenderStore((s) => s.level);
  const labelLayer = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const loadSky = useSkyStore((s) => s.load);
  useEffect(() => {
    if (useSkyStore.getState().status === 'idle') void loadSky();
  }, [loadSky]);
  return (
    <div className="scene" ref={sceneRef}>
      <Canvas
        gl={{ logarithmicDepthBuffer: true, antialias: true }}
        camera={{ fov: 50, near: 0.001, far: 1e13, position: [0, 0, 0] }}
        dpr={canvasDpr(level, typeof window === 'undefined' ? 1 : window.devicePixelRatio)}
      >
        <color attach="background" args={['#03050b']} />
        <LabelLayerContext.Provider value={labelLayer}>
          <FrameStateProvider>
            <SkyBackground />
            <FrameDriver bodies={catalog.bodies} />
            <CameraSystem catalog={catalog} />
            <QualityGovernor />
            {catalog.bodies.map((body) => (
              <BodyMesh key={body.id} body={body} bodies={catalog.bodies} />
            ))}
            {catalog.bodies.filter(hasApproxOrbit).map((body) => (
              <OrbitLine key={`orbit-${body.id}`} body={body} />
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
