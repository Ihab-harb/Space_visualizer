import { FrontSide, NormalBlending, ShaderMaterial, Vector3, Vector4, type Blending, type IUniform, type Side } from 'three';
import { BODY_VERTEX, ECLIPSE, FRAG_HEADER, LIGHTING, NOISE } from './chunks';

export function createBaseUniforms(): Record<string, IUniform> {
  return {
    uSunDirObj: { value: new Vector3(1, 0, 0) },
    uCamObj: { value: new Vector3(0, 0, 3) },
    uFlattening: { value: 1 },
    uTime: { value: 0 },
    uSimDays: { value: 0 },
    uFill: { value: 1 },
    uSunIntensity: { value: 1 },
    uSunDistTrue: { value: 23000 },
    uSunRadiusTrue: { value: 100 },
    uOccluderCount: { value: 0 },
    uOccluders: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
  };
}

/** Fragment source = shared header + noise + lighting + eclipse helpers + the material's own code (which defines main). */
export function createBodyMaterial(opts: {
  fragment: string;
  uniforms?: Record<string, IUniform>;
  vertex?: string;
  transparent?: boolean;
  blending?: Blending;
  side?: Side;
  depthWrite?: boolean;
  toneMapped?: boolean;
}): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: opts.vertex ?? BODY_VERTEX,
    fragmentShader: `${FRAG_HEADER}\n${NOISE}\n${LIGHTING}\n${ECLIPSE}\n${opts.fragment}`,
    uniforms: { ...createBaseUniforms(), ...opts.uniforms },
    transparent: opts.transparent ?? false,
    blending: opts.blending ?? NormalBlending,
    side: opts.side ?? FrontSide,
    depthWrite: opts.depthWrite ?? true,
    toneMapped: opts.toneMapped ?? true,
  });
}
