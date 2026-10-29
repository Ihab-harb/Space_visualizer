---
title: scene
tags: [architecture]
---

# scene (`src/scene`)

Back to [[Home]] · [[Overview]] · [[render]]

- **FrameState:** a mutable per-frame cache (positions, validity, orientations, camera position), shared through context and never stored in React state.
- **Scale modes:** `renderRadiusKm` keeps the real radius in true-scale mode. In readable mode it enforces a minimum on-screen size (10 px for the Sun, 5 px for other bodies).
- **Bodies:** ellipsoids with PCK radii, oriented by the IAU rotation models (sphere geometry rotated so its poles lie on +Z). Surfaces use official NASA/USGS/STScI imagery where a body has a map; procedural layers (Venus clouds, Sun surface, ring tint, band flow, cloud drift, exaggerated relief) are labelled illustrative.
- **Orbit lines:** rebuilt every frame relative to the camera, so they stay precise next to the planet.
- **Light:** there are no three.js lights. Each body shader lights itself from `uSunDirObj` (Sun direction in the mesh's object space, computed in float64 on the CPU); bloom and the rest of the post-processing stack are described in [[render]].
- **Labels:** drei `<Html>` rendered into a fixed `.label-layer` portal (`LabelLayerContext`). `BodyMesh` positions at priority −0.5 so labels never project from the camera's own position (which would cache `NaN`).
- **SceneRoot:** `div.scene` (an isolated stacking context, so the panels stay above the labels) containing the Canvas and the label layer.

## Rendering (M2a.1)

See also the M2 spec [[2026-10-04-m2-cinematic-and-rich-bodies-design]] and decision [[0005-webgl2-custom-shaders]].

- **Object-space shading:** every body shader works in the mesh's object space, where the unit sphere is the rendered equatorial radius and the surface point is `vec3(vUnit.xy, vUnit.z * uFlattening)`. The Sun and camera directions (`uSunDirObj`, `uCamObj`) are computed on the CPU in float64 by `bodyUniforms.ts`; `useBodyUniforms` writes them every frame at `useFrame` priority −0.4.
- **Materials:** `createBodyMaterial` prepends the shared GLSL chunks (`chunks.ts`: noise, lighting, eclipse) to each fragment. The material follows `render.shader`: `EarthMaterial`, `RockyMaterial`, `GiantMaterial` (illustrative band flow), `VenusMaterial` (illustrative cloud deck) and `SunMaterial` (illustrative granulation and limb darkening).
- **BodyExtras:** shells drawn with a body: `CloudShell` (Earth clouds, drift illustrative, cloud shadows), `AtmosphereShell` (O'Neil scattering: GroundFromSpace for rays that hit the planet, SkyFromSpace with a fit-error clamp for sky rays), `RingShell` (Saturn and Uranus rings from the NSSDCA ring tables, planet shadow on the rings and ring shadow on the globe, lit and unlit faces; the file is `RingShell.tsx`, not `Rings.tsx`, which would collide with `rings.ts` on Windows) and `CoronaGlow` (Sun).
- **Log depth:** every `ShaderMaterial` includes three's `logdepthbuf` chunks. Surface shaders end with the tonemapping and colour-space chunks.
- **Sky:** a sphere that follows the camera, textured with the NASA Deep Star Maps (2k and 4k committed, credit in the app).
- **Tiered loading:** `useTieredTexture` loads the best tier up to `viewStore.textureTier` (default 2k), falls back to lower tiers, disposes superseded textures and cancels stale loads. `TextureReadiness` sets `data-textures-ready` on the scene so e2e screenshots wait for the textures.
- **URL overrides:** `jd`, `date`, `pause`, `target`, `dist`, `az`, `azSun`, `el` and `tier` (see `urlParams.ts`) set a reproducible view; the golden screenshots use them.
- **Disposal:** every material and geometry created in `useMemo` is disposed on change and unmount.

## The Moon (M2b.2)
- **Positions:** the frame driver uses `systemState`, so Earth and the Moon move about their barycentre. The orbit line is `SatelliteOrbitLine.tsx`: the geocentric path of one lunar month, parented to Earth, disposed on change.
- **Hiding rule (`satelliteVisibility.ts`, `BodyMesh.tsx`):** a satellite is drawn only when it is clear of its parent's drawn disc plus its own radius plus a 4 px margin. The rule is binary (no fade) and applies in both scale modes. A hidden body adds its id to `frame.bodyHidden`, its raycast is off and its label is hidden. Selecting a hidden Moon still flies the camera to it, and it shows as the camera closes in.
- **Minimum size:** `MIN_PIXELS` is `{ star: 10, body: 5, moon: 3 }` (`scaleMode.ts`).
- **Tour:** the Moon is a stop, ordered by `meanDistanceFromParentKm`.
- **Shading (`RockyMaterial`):** Lommel-Seeliger uses the relief normal for both mu0 and mu, so a full Moon is evenly bright and the terminator keeps its relief. **Earthshine** lights the night side from Earth's direction with strength `EARTHSHINE.max * (1 + cos phi) / 2`, where phi is the angle at Earth between the Sun and the Moon. It applies only to Earth's moons (`receivesEarthshine`).
- **Eclipse tint:** `occluderVisibility` is shared by `eclipseFactor` and the new `eclipseLight`. When the occluder has an atmosphere (a data flag, `render.atmosphere !== null`), the remaining light is mixed toward `ECLIPSE_TINT.color` (copper red), and the umbra keeps a floor of light. `pickOccluders` puts Earth first for the Moon and the Moon first for Earth.
- **Atmosphere eclipse shade:** `AtmosphereShell` multiplies its in-scatter by `eclipseFactor` at the path midpoint, so the Moon's shadow shows through Earth's haze (golden 6d). It applies to every shell.
- **Illustrative constants** (`illustrative.ts`, labelled in the drawer): `EARTHSHINE` { max 0.02 } and `ECLIPSE_TINT` { color (1, 0.30, 0.08), amount 0.9, floor 0.12, centreDarkening 0.5 }. Reasons are in [[2026-10-29-m2b2-moon]].
- **Goldens:** six views (6 to 6f) in `e2e/golden.spec.ts`; screenshots in `Assets/m2b2/`.
