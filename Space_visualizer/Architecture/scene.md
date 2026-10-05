---
title: scene
tags: [architecture]
---

# scene (`src/scene`)

Back to [[Home]] · [[Overview]]

- **FrameState:** a mutable per-frame cache (positions, validity, orientations, camera position), shared through context and never stored in React state.
- **Scale modes:** `renderRadiusKm` keeps the real radius in true-scale mode. In readable mode it enforces a minimum on-screen size (10 px for the Sun, 5 px for other bodies).
- **Bodies:** ellipsoids with PCK radii, oriented by the IAU rotation models (sphere geometry rotated so its poles lie on +Z). Colours are illustrative.
- **Orbit lines:** rebuilt every frame relative to the camera, so they stay precise next to the planet.
- **Light:** the Sun is the only real light (point light, decay 0), plus a 3.5 % ambient fill and bloom.
- **Labels:** drei `<Html>` rendered into a fixed `.label-layer` portal (`LabelLayerContext`). `BodyMesh` positions at priority −0.5 so labels never project from the camera's own position (which would cache `NaN`).
- **SceneRoot:** `div.scene` (an isolated stacking context, so the panels stay above the labels) containing the Canvas and the label layer.

## Rendering (M2a.1)

See also the M2 spec [[2026-10-04-m2-cinematic-and-rich-bodies-design]] and decision [[0005-webgl2-custom-shaders]]. The M1 point light and ambient fill above were retired in favour of the shaders.

- **Object-space shading:** every body shader works in the mesh's object space, where the unit sphere is the rendered equatorial radius and the surface point is `vec3(vUnit.xy, vUnit.z * uFlattening)`. The Sun and camera directions (`uSunDirObj`, `uCamObj`) are computed on the CPU in float64 by `bodyUniforms.ts`; `useBodyUniforms` writes them every frame at `useFrame` priority −0.4.
- **Materials:** `createBodyMaterial` prepends the shared GLSL chunks (`chunks.ts`: noise, lighting, eclipse) to each fragment. The material follows `render.shader`: `EarthMaterial`, `RockyMaterial`, `GiantMaterial` (illustrative band flow), `VenusMaterial` (illustrative cloud deck) and `SunMaterial` (illustrative granulation and limb darkening).
- **BodyExtras:** shells drawn with a body: `CloudShell` (Earth clouds, drift illustrative, cloud shadows), `AtmosphereShell` (O'Neil scattering: GroundFromSpace for rays that hit the planet, SkyFromSpace with a fit-error clamp for sky rays), `RingShell` (Saturn and Uranus rings from the NSSDCA ring tables, planet shadow on the rings and ring shadow on the globe, lit and unlit faces; the file is `RingShell.tsx`, not `Rings.tsx`, which would collide with `rings.ts` on Windows) and `CoronaGlow` (Sun).
- **Log depth:** every `ShaderMaterial` includes three's `logdepthbuf` chunks. Surface shaders end with the tonemapping and colour-space chunks.
- **Sky:** a sphere that follows the camera, textured with the NASA Deep Star Maps (2k and 4k committed, credit in the app).
- **Tiered loading:** `useTieredTexture` loads the best tier up to `viewStore.textureTier` (default 2k), falls back to lower tiers, disposes superseded textures and cancels stale loads. `TextureReadiness` sets `data-textures-ready` on the scene so e2e screenshots wait for the textures.
- **URL overrides:** `jd`, `date`, `pause`, `target`, `dist`, `az`, `azSun`, `el` and `tier` (see `urlParams.ts`) set a reproducible view; the golden screenshots use them.
- **Disposal:** every material and geometry created in `useMemo` is disposed on change and unmount.
