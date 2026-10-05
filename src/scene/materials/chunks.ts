/** Shared GLSL. All body shaders work in object space: unit sphere = rendered equatorial radius. */

export const BODY_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vUnit;
varying vec2 vUv;
varying vec2 vPlane;
void main() {
  vUnit = position;
  vUv = uv;
  vPlane = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

export const FRAG_HEADER = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunDirObj;
uniform vec3 uCamObj;
uniform float uFlattening;
uniform float uTime;
uniform float uSimDays;
uniform float uFill;
uniform float uSunIntensity;
uniform float uSunDistTrue;
uniform float uSunRadiusTrue;
uniform int uOccluderCount;
uniform vec4 uOccluders[4];
varying vec3 vUnit;
varying vec2 vUv;
varying vec2 vPlane;
`;

/** 3D simplex noise: Ian McEwan & Stefan Gustavson (Ashima Arts), MIT licence (webgl-noise). */
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) { sum += amp * snoise(p); p *= 2.02; amp *= 0.5; }
  return sum;
}
`;

export const LIGHTING = /* glsl */ `
vec3 surfacePoint(vec3 unit) { return vec3(unit.xy, unit.z * uFlattening); }
vec3 surfaceNormal(vec3 unit) { return normalize(vec3(unit.xy, unit.z / uFlattening)); }
/** Tangent-space normal map (x = east, y = north, z = up) applied around normal n (pole = +z). */
vec3 perturbNormal(vec3 n, vec3 texel, float strength) {
  vec3 t = texel * 2.0 - 1.0;
  t.xy *= strength;
  vec3 east = normalize(vec3(-n.y, n.x, 0.0) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(n, east);
  return normalize(t.x * east + t.y * north + t.z * n);
}
/** Cinematic fill: faint cool light from the camera side so night sides read as deep blue-black. */
vec3 cinematicFill(vec3 albedo, vec3 n, vec3 v) {
  return uFill * albedo * vec3(0.05, 0.07, 0.13) * (0.35 + 0.65 * max(dot(n, v), 0.0));
}
/** Lommel-Seeliger (x2 so it matches Lambert at normal incidence), gated by the geometric terminator. */
float lommelSeeliger(float mu0, float mu, float geoMu0) {
  return step(0.0, geoMu0) * 2.0 * mu0 / max(mu0 + mu, 1e-4);
}
float ggx(vec3 n, vec3 v, vec3 l, float roughness) {
  vec3 h = normalize(v + l);
  float a2 = roughness * roughness * roughness * roughness;
  float nh = max(dot(n, h), 0.0);
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}
`;

export const ECLIPSE = /* glsl */ `
float sunVisibleFraction(float rs, float ro, float d) {
  if (d >= rs + ro) return 1.0;
  if (d <= abs(ro - rs)) return ro >= rs ? 0.0 : 1.0 - (ro * ro) / (rs * rs);
  float a1 = rs * rs * acos(clamp((d * d + rs * rs - ro * ro) / (2.0 * d * rs), -1.0, 1.0));
  float a2 = ro * ro * acos(clamp((d * d + ro * ro - rs * rs) / (2.0 * d * ro), -1.0, 1.0));
  float a3 = 0.5 * sqrt(max((-d + rs + ro) * (d + rs - ro) * (d - rs + ro) * (d + rs + ro), 0.0));
  return 1.0 - (a1 + a2 - a3) / (PI * rs * rs);
}
/** Sunlight fraction at a point (true-radius units, body centre at origin) behind up to 4 occluders. */
float eclipseFactor(vec3 p) {
  vec3 toSun = uSunDirObj * uSunDistTrue - p;
  float dSun = length(toSun);
  float as = asin(clamp(uSunRadiusTrue / dSun, 0.0, 1.0));
  float vis = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uOccluderCount) break;
    vec3 toOcc = uOccluders[i].xyz - p;
    float dOcc = length(toOcc);
    if (dOcc >= dSun) continue;
    float ao = asin(clamp(uOccluders[i].w / dOcc, 0.0, 1.0));
    float sep = acos(clamp(dot(toSun / dSun, toOcc / dOcc), -1.0, 1.0));
    vis *= sunVisibleFraction(as, ao, sep);
  }
  return vis;
}
bool rayHitsEllipsoid(vec3 o, vec3 d, float f) {
  vec3 os = vec3(o.xy, o.z / f);
  vec3 ds = vec3(d.xy, d.z / f);
  float a = dot(ds, ds);
  float b = dot(os, ds);
  float c = dot(os, os) - 1.0;
  float disc = b * b - a * c;
  if (disc < 0.0) return false;
  return (-b - sqrt(disc)) / a > 1e-4;
}
`;

export const FRAG_OUTRO = /* glsl */ `
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

export const FRAG_OUTRO_NO_TONEMAP = /* glsl */ `
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
`;
