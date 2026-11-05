import { BackSide, DoubleSide, FrontSide, Matrix4, ShaderMaterial, Vector2, Vector3, type IUniform } from 'three';
import type { DrawnLayer } from '../../core/interior/geometry';
import { NOISE } from '../materials/chunks';
import { layerColours, type InteriorKind } from './interiorPalette';

/** Most layers an interior may have (the data has at most four). */
export const MAX_LAYERS = 8;

/**
 * Look constants of the interior (illustrative, tuned on the Explore screenshots, Task 6). The interior emits most of its
 * light so the cut reads on the night side; sunlight adds shape on top.
 */
export const INTERIOR_LOOK = {
  /** Emission = colour x (base + glow x gain). */
  emitBase: 0.12,
  glowGain: 0.34,
  /** Sunlight on the cut face and on the shells. */
  sunlight: 0.6,
  /** Brightness of the thin boundary lines on the cut face. */
  line: 0.55,
  /** Unselected layers while another is selected. */
  unselected: 0.35,
  /** The inside of a hollow shell, relative to its colour. */
  hollow: 0.55,
  /**
   * The Sun's interior is self-luminous like its photosphere (drawn at 2.2 x its colour, then dimmed by the scene exposure
   * while the Sun fills the frame): its zones are scaled up by this so the core reads as the hottest, brightest part.
   */
  starGain: 2.4,
} as const;

/** Uniforms shared by every interior material of one body (layer table, cut plane, light). */
export function createSharedUniforms(): Record<string, IUniform> {
  return {
    uCount: { value: 0 },
    uOuter: { value: new Array(MAX_LAYERS).fill(0) },
    uInner: { value: new Array(MAX_LAYERS).fill(0) },
    uBandTop: { value: new Array(MAX_LAYERS).fill(0) },
    uBandBottom: { value: new Array(MAX_LAYERS).fill(0) },
    uTopColor: { value: Array.from({ length: MAX_LAYERS }, () => new Vector3()) },
    uBottomColor: { value: Array.from({ length: MAX_LAYERS }, () => new Vector3()) },
    uGlow: { value: Array.from({ length: MAX_LAYERS }, () => new Vector2()) },
    uCells: { value: 0 },
    uEmitGain: { value: 1 },
    uSelected: { value: -1 },
    uPlane: { value: new Vector3(0, 0, 1) },
    uUpObj: { value: new Vector3(0, 0, 1) },
    uPlaneOffset: { value: 4 },
    uSunDirObj: { value: new Vector3(1, 0, 0) },
    uSunLight: { value: 1 },
    uFlattening: { value: 1 },
    uTime: { value: 0 },
  };
}

/** Writes the layer table: boundaries, bands and the illustrative colours at each layer's top and bottom. */
export function writeLayerTable(shared: Record<string, IUniform>, drawn: readonly DrawnLayer[], kind: InteriorKind): void {
  const n = Math.min(drawn.length, MAX_LAYERS);
  shared.uCount!.value = n;
  for (let i = 0; i < n; i++) {
    const layer = drawn[i]!;
    const c = layerColours(layer.state, layer.outer, layer.inner, kind);
    shared.uOuter!.value[i] = layer.outer;
    shared.uInner!.value[i] = i === n - 1 ? 0 : layer.inner;
    shared.uBandTop!.value[i] = layer.outerBand;
    shared.uBandBottom!.value[i] = layer.innerBand;
    (shared.uTopColor!.value[i] as Vector3).set(...c.top.rgb);
    (shared.uBottomColor!.value[i] as Vector3).set(...c.bottom.rgb);
    (shared.uGlow!.value[i] as Vector2).set(c.top.glow, c.bottom.glow);
  }
  // Faint convection cells in the Sun's outer zone (illustrative, spec §6).
  shared.uCells!.value = kind === 'star' ? 1 : 0;
  shared.uEmitGain!.value = kind === 'star' ? INTERIOR_LOOK.starGain : 1;
}

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform mat4 uLocal;
varying vec3 vBody;
void main() {
  vBody = (uLocal * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

const HEADER = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
#define MAX_LAYERS ${MAX_LAYERS}
uniform int uCount;
uniform float uOuter[MAX_LAYERS];
uniform float uInner[MAX_LAYERS];
uniform float uBandTop[MAX_LAYERS];
uniform float uBandBottom[MAX_LAYERS];
uniform vec3 uTopColor[MAX_LAYERS];
uniform vec3 uBottomColor[MAX_LAYERS];
uniform vec2 uGlow[MAX_LAYERS];
uniform float uCells;
uniform float uEmitGain;
uniform int uSelected;
uniform vec3 uPlane;
uniform vec3 uUpObj;
uniform float uPlaneOffset;
uniform vec3 uSunDirObj;
uniform float uSunLight;
uniform float uFlattening;
uniform float uTime;
uniform vec3 uCamObj;
uniform int uLayer;
uniform float uClipOn;
varying vec3 vBody;
${NOISE}
/** Ellipsoidal radius: 1 on the surface, layer boundaries at their drawn fractions. */
float bodyRadius(vec3 p) { return length(vec3(p.xy, p.z / uFlattening)); }
/** Colour and glow of layer i at radius r (top to bottom gradient). */
vec3 layerColour(int i, float r, out float glow) {
  float top = uOuter[i];
  float bottom = uInner[i];
  float t = clamp((top - r) / max(top - bottom, 1e-4), 0.0, 1.0);
  glow = mix(uGlow[i].x, uGlow[i].y, t);
  return mix(uTopColor[i], uBottomColor[i], t);
}
/** Grain and flow: rock is grainy, deep hot layers swirl slowly; the Sun's outer zone shows cells. All illustrative. */
float texture3(int i, vec3 p, float r, float glow) {
  float grain = fbm(p * 14.0) * 0.22 * (1.0 - clamp(glow - 1.0, 0.0, 0.7));
  float swirl = snoise(vec3(p.xy * 5.0, p.z * 5.0) + vec3(0.0, 0.0, uTime * 0.03)) * 0.06 * clamp(glow - 0.6, 0.0, 1.0);
  float cells = 0.0;
  if (uCells > 0.5 && i == 0) {
    vec3 dir = normalize(p);
    float c = snoise(dir * 9.0 + vec3(r * 4.0, 0.0, uTime * 0.02));
    cells = 0.16 * (smoothstep(-0.1, 0.55, c) - 0.5);
  }
  return 1.0 + grain + swirl + cells;
}
vec3 emit(vec3 colour, float glow, float sun) {
  // Hot layers glow on their own; sunlight on them would only wash the colour out under the filmic tone mapping.
  float lit = sun * ${INTERIOR_LOOK.sunlight.toFixed(3)} * uSunLight * (1.0 - 0.8 * clamp(glow - 0.8, 0.0, 1.0));
  return colour * ((${INTERIOR_LOOK.emitBase.toFixed(3)} + glow * ${INTERIOR_LOOK.glowGain.toFixed(3)}) * uEmitGain + lit);
}
float selectionScale(int i) {
  if (uSelected < 0) return 1.0;
  return i == uSelected ? 1.2 : ${INTERIOR_LOOK.unselected.toFixed(3)};
}
bool clipped(vec3 p) { return uClipOn > 0.5 && dot(uPlane, p) > uPlaneOffset; }
`;

const OUTRO = /* glsl */ `
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

/** The cut face: layers as clean rings with soft bands where a bound is a range, and thin boundary lines. */
const FACE = /* glsl */ `
uniform vec2 uRange;
void main() {
  vec3 p = vBody;
  float r = bodyRadius(p);
  float aa = max(fwidth(r), 1e-5);
  if (r > uRange.y + aa || r < uRange.x - aa) discard;
  // Soft membership of each layer: a band where the bound is a range, a pixel-wide edge where it is sharp.
  vec3 colour = vec3(0.0);
  float glow = 0.0;
  float weight = 0.0;
  float select = 0.0;
  for (int i = 0; i < MAX_LAYERS; i++) {
    if (i >= uCount) break;
    float halfTop = max(uBandTop[i] * 0.5, aa * 0.75);
    float halfBottom = max(uBandBottom[i] * 0.5, aa * 0.75);
    float w = (1.0 - smoothstep(uOuter[i] - halfTop, uOuter[i] + halfTop, r)) * (uInner[i] <= 0.0 ? 1.0 : smoothstep(uInner[i] - halfBottom, uInner[i] + halfBottom, r));
    if (w <= 0.0) continue;
    float g;
    vec3 c = layerColour(i, r, g) * texture3(i, p, r, g);
    colour += c * w;
    glow += g * w;
    select += selectionScale(i) * w;
    weight += w;
  }
  if (weight <= 0.0) discard;
  colour /= weight;
  glow /= weight;
  select /= weight;
  // Thin boundary lines at sharp boundaries and around the rim.
  float line = 0.0;
  for (int i = 0; i < MAX_LAYERS; i++) {
    if (i >= uCount) break;
    if (uBandTop[i] <= 0.0) line = max(line, 1.0 - smoothstep(0.0, aa * 1.4, abs(r - uOuter[i])));
  }
  // A faint shade under each boundary gives the rings depth.
  float shade = 1.0;
  for (int i = 1; i < MAX_LAYERS; i++) {
    if (i >= uCount) break;
    float d = uOuter[i] - r;
    if (d >= 0.0) shade = min(shade, mix(0.6, 1.0, smoothstep(0.0, 0.05, d)));
  }
  float sun = max(dot(uPlane, uSunDirObj), 0.0);
  vec3 c = emit(colour, glow, sun) * shade * select;
  c = mix(c, vec3(1.0, 0.94, 0.86) * (0.6 + 0.4 * glow), line * ${INTERIOR_LOOK.line.toFixed(3)});
  gl_FragColor = vec4(c, 1.0);
  ${OUTRO}
}`;

/** A layer's outer surface (the dome of a lifted cap, or the innermost sphere). */
const SHELL = /* glsl */ `
void main() {
  vec3 p = vBody;
  if (clipped(p)) discard;
  float r = bodyRadius(p);
  vec3 n = normalize(vec3(p.xy, p.z / (uFlattening * uFlattening)));
  vec3 v = normalize(uCamObj - p);
  float g;
  vec3 colour = layerColour(uLayer, uOuter[uLayer], g) * texture3(uLayer, p, r, g);
  float sun = max(dot(n, uSunDirObj), 0.0);
  float facing = max(dot(n, v), 0.0);
  float rim = pow(1.0 - facing, 3.0);
  // Studio shaping so a cap reads as a dome: darker toward its limb, lit a little from above.
  float shape = (0.5 + 0.5 * facing) * (0.8 + 0.35 * max(dot(n, uUpObj), 0.0));
  vec3 c = emit(colour, g, sun) * shape + colour * rim * (0.25 + 0.3 * g);
  gl_FragColor = vec4(c * selectionScale(uLayer), 1.0);
  ${OUTRO}
}`;

/** The inside of a hollow cap (seen through its open base). */
const HOLLOW = /* glsl */ `
void main() {
  vec3 p = vBody;
  if (clipped(p)) discard;
  float r = bodyRadius(p);
  vec3 n = -normalize(vec3(p.xy, p.z / (uFlattening * uFlattening)));
  float g;
  vec3 colour = layerColour(uLayer, uInner[uLayer], g) * texture3(uLayer, p, r, g);
  float sun = max(dot(n, uSunDirObj), 0.0) * 0.4;
  vec3 c = emit(colour, g, sun) * ${INTERIOR_LOOK.hollow.toFixed(3)};
  gl_FragColor = vec4(c * selectionScale(uLayer), 1.0);
  ${OUTRO}
}`;

export type InteriorPart = 'face' | 'shell' | 'hollow';

/** One interior material. Shared uniforms are passed by reference, so writing them once updates every part. */
export function createInteriorMaterial(part: InteriorPart, shared: Record<string, IUniform>, layerIndex: number): ShaderMaterial {
  const own: Record<string, IUniform> = {
    uLocal: { value: new Matrix4() },
    uCamObj: { value: new Vector3(0, 0, 4) },
    uLayer: { value: layerIndex },
    uClipOn: { value: 1 },
    uRange: { value: new Vector2(0, 1) },
  };
  const fragment = part === 'face' ? FACE : part === 'shell' ? SHELL : HOLLOW;
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: `${HEADER}\n${fragment}`,
    uniforms: { ...shared, ...own },
    side: part === 'face' ? DoubleSide : part === 'hollow' ? BackSide : FrontSide,
  });
}
