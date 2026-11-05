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
    uOccluderAtmo: { value: new Vector4() },
    uEarthshine: { value: 0 },
    uEarthshineDir: { value: new Vector3(0, 0, 1) },
    uClip: { value: new Vector4(0, 0, 1, NO_CLIP) },
    uDim: { value: 1 },
  };
}

/** A clip offset this large removes nothing. */
export const NO_CLIP = 4;

/**
 * Explore support for every body material (Task 6). The material's own main() is renamed and wrapped: fragments whose
 * body-frame point (surfacePoint(vUnit) x the shell's radius, in equatorial radii) lies beyond the plane uClip (xyz normal,
 * w offset) are discarded, so the outer shell opens with the cut; and the colour is scaled by uDim (other bodies fade to
 * about 25 % in Explore). useBodyUniforms writes both every frame.
 */
export function wrapForExplore(fragment: string, clipScale: number): string {
  const renamed = fragment.replace(/void\s+main\s*\(\s*\)\s*\{/, 'void svBodyMain() {');
  if (renamed === fragment) throw new Error('createBodyMaterial: the fragment needs a main() to wrap');
  return `${renamed}
void main() {
  if (dot(uClip.xyz, surfacePoint(vUnit) * ${clipScale.toFixed(4)}) > uClip.w) discard;
  svBodyMain();
  gl_FragColor.rgb *= uDim;
}`;
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
  /** Radius of this shell in body equatorial radii (clouds 1.006, atmosphere its outer radius), for the Explore cut. */
  clipScale?: number;
}): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: opts.vertex ?? BODY_VERTEX,
    fragmentShader: `${FRAG_HEADER}\nuniform vec4 uClip;\nuniform float uDim;\n${NOISE}\n${LIGHTING}\n${ECLIPSE}\n${wrapForExplore(opts.fragment, opts.clipScale ?? 1)}`,
    uniforms: { ...createBaseUniforms(), ...opts.uniforms },
    transparent: opts.transparent ?? false,
    blending: opts.blending ?? NormalBlending,
    side: opts.side ?? FrontSide,
    depthWrite: opts.depthWrite ?? true,
    toneMapped: opts.toneMapped ?? true,
  });
}
