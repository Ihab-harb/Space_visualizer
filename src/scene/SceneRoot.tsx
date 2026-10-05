import { Canvas } from '@react-three/fiber';
import { useRef } from 'react';
import { CameraSystem } from '../camera/CameraSystem';
import type { Catalog } from '../core/catalog/catalog';
import type { Body, PlanetApproxOrbit } from '../core/catalog/schema';
import { BodyMesh } from './BodyMesh';
import { Effects } from './Effects';
import { FrameDriver } from './FrameDriver';
import { FrameStateProvider } from './FrameStateContext';
import { LabelLayerContext } from './LabelLayerContext';
import { OrbitLine } from './OrbitLine';
import { SunLight } from './SunLight';
import { TextureReadiness } from './TextureReadiness';

const hasApproxOrbit = (b: Body): b is Body & { orbit: PlanetApproxOrbit } => b.orbit.type === 'planet-approx';

export function SceneRoot({ catalog }: { catalog: Catalog }) {
  const star = catalog.bodies.find((b) => b.category === 'star');
  const labelLayer = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  return (
    <div className="scene" ref={sceneRef}>
      <Canvas
        gl={{ logarithmicDepthBuffer: true, antialias: true }}
        camera={{ fov: 50, near: 0.001, far: 1e13, position: [0, 0, 0] }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#03050b']} />
        <LabelLayerContext.Provider value={labelLayer}>
          <FrameStateProvider>
            <FrameDriver bodies={catalog.bodies} />
            <CameraSystem catalog={catalog} />
            <ambientLight intensity={0.035} />
            {star && <SunLight bodyId={star.id} />}
            {catalog.bodies.map((body) => (
              <BodyMesh key={body.id} body={body} bodies={catalog.bodies} />
            ))}
            {catalog.bodies.filter(hasApproxOrbit).map((body) => (
              <OrbitLine key={`orbit-${body.id}`} body={body} />
            ))}
            <Effects />
          </FrameStateProvider>
        </LabelLayerContext.Provider>
      </Canvas>
      <TextureReadiness target={sceneRef} />
      <div className="label-layer" ref={labelLayer} />
    </div>
  );
}
