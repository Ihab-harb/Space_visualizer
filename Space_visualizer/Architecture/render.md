---
title: render
tags: [architecture]
---

# render (`src/render`)

Back to [[Home]] · [[Overview]] · [[scene]] · Plan: [[2026-10-05-m2a2-cinematic-effects-and-quality]] · Decision: [[0007-tone-mapping-and-exposure]]

Post-processing, adaptive quality and the Sun-driven effects. Everything here changes how the scene is drawn, never the data behind it.

## Modules

| Module | Role |
|---|---|
| `quality.ts` | `PRESETS` (spec §5 table), `pixelRatioFor`, `canvasDpr`, `stepDown`/`stepUp`, `initialLevel`, `activePasses(level, effects, hasFocus)` |
| `autoQuality.ts` | The Auto controller: warm-up, median window, step down/up, cooldown |
| `QualityGovernor.tsx` | Feeds frame times to the controller and writes the level to `renderStore`; installs `window.__svRenderInfo` (dev) |
| `RenderStateAttributes.tsx` | Writes `data-quality`, `data-quality-mode` and `data-fx` on `.scene` |
| `useMaxTier.ts` | Highest texture tier the level allows and the build contains |
| `EffectsStack.tsx` | Builds the `EffectComposer` and its passes in order; installs `window.__svPasses` (dev) |
| `passSegments.ts` | `segmentByAttributes`: splits the effect list into runs so `EffectPass` does not reorder them |
| `sunFx.ts` | Per-frame Sun effects driver: god-ray proxy, flare occlusion, exposure targets |
| `exposure.ts` | Pure rules: `sunFrameWeight`, `sceneExposure`, `godRayOpacity`, `damp` |
| `dof.ts` | Focus distance and range for depth of field, and the log-depth patch for the circle-of-confusion shader |
| `effects/AnamorphicStreakEffect.ts` | Horizontal HDR streaks from bright sources |
| `effects/ExposureEffect.ts` | Scene exposure multiplier ahead of tone mapping |

State lives in `renderStore` (see [[state]]): `mode` (auto, high, medium, low), `level` (effective), `effects` (Camera effects on or off).

## Quality model

Spec §5 table, as implemented in `PRESETS`:

| Setting | High | Medium | Low |
|---|---|---|---|
| Pixel ratio | min(devicePixelRatio, 2) | min(devicePixelRatio, 1.25) | 1 |
| Sphere segments | 192 x 96 | 96 x 48 | 48 x 24 |
| Texture tier (max) | 8k / 4k | 2k | 1k |
| Atmosphere samples | 16 | 8 | 4 |
| Bloom levels | 8 | 5 | 3 |
| DoF / grain / chromatic aberration / streaks | on | on (lighter) | off |
| Sun rays | on | on | off |

- **HD tiers** come from a build-time virtual module (`virtual:local-tiers`, `pipeline/vite/localTiers`) that lists the tier files present when the dev server or build starts. High asks for 8k but only requests tiers in that list, so a static host never produces a 404. Restart `npm run dev` after `npm run textures:hd`.
- **Canvas dpr** is driven from the level: `canvasDpr(level, devicePixelRatio)` is passed as the numeric `dpr` prop. R3F resets its own dpr on every Canvas render, so there is a single writer.
- **Phones** (coarse pointer and viewport narrower than 900 px) start at Low.

### Auto rules

From spec §5: after a 3 s warm-up the controller measures the median frame time over a 2 s window. It steps down above 18 ms, steps up after 10 s below 12 ms, and waits 5 s after any change. Frames longer than 250 ms (tab switch, debugger pause) are ignored. Constants are in `AUTO_QUALITY`.

## Pass order and toggles

Order (plan Global Constraints): bloom, god rays and lens flare, anamorphic streaks, depth of field, exposure, tone mapping, chromatic aberration, vignette, grain. `activePasses` returns the list; `data-fx` is the same list, comma separated.

- **Camera effects off** (key E, `?fx=0`): only bloom (reduced strength) and Neutral tone mapping, and the cinematic fill is off.
- **Depth of field** only runs while a body is selected (it needs a focus point).
- **Low** has no rays, flare, streaks, DoF, chromatic aberration or grain; vignette stays.

How the passes are assembled in three.js (all rulings from the M2a.2 ledger):

- Display effects (chromatic aberration, vignette, grain) sit in their own `EffectPass` after tone mapping, because merged into the HDR pass chromatic aberration sampled untonemapped values.
- `EffectPass` re-sorts merged effects by attribute, so `segmentByAttributes` turns each non-increasing run into its own `EffectGroup`. At High the result is `[bloom] [rays, flare] [streaks] [dof, exposure, tonemap] [display]`. One convolution effect per pass is a library rule.
- The stock circle-of-confusion shader mishandles our logarithmic depth buffer (it blurred the planet and left the sky sharp), so `patchCocForLogDepth` rewrites it.
- The `EffectComposer` is keyed on the pass list, so it remounts whenever the list changes. This is a workaround for a stale depth-of-field frame left after the DoF pass is removed; the root cause in `@react-three/postprocessing` was not found. It costs a rebuild hitch on each toggle (see the carry-over note).
- `autoClear={false}` on the composer is not adopted, although GodRays logs a warning asking for it: it hid the god-ray proxy behind the Sun mesh and added a square artifact. See [[0007-tone-mapping-and-exposure]].
- Tone mapping is AgX (compared with ACES in [[0007-tone-mapping-and-exposure]]).

Frame order (`useFrame` priority): FrameDriver -2, CameraSystem -1, BodyMesh -0.5, body uniforms -0.4, Sun effects -0.3, other components 0, and the composer renders at `renderPriority` 1.

## Scene-driven exposure

Exposure is not metered from the image. `sunFrameWeight` combines the Sun's visible fraction (float64, from the core) with how far inside the frame it is (fading out between NDC edge 1 and 1.3). `sceneExposure` turns that weight and the Sun's angular size into an exposure dip (0.15 for a small Sun up to 0.6 at 5 degrees) and a star-dimming factor (stars fall to 0.4 at full weight). Both are damped (lambda 4). `ExposureEffect` applies the multiplier before tone mapping; `Sky` applies the dimming.

## Sun occlusion from core

Lens-flare occlusion does not use the `<LensFlare>` raycast. `useSunFx` calls `sunVisibilityFromObserver` (float64, render radii) from the camera, so a planet crossing the Sun fades the flare exactly as the eclipse code would. The library's flare shader inverts opacity (`mix(flare, 0, opacity)`), so the flare is driven with opacity = 1 - weight.

## God-ray proxy

The god-ray source is a sphere at 0.98 of the Sun's render radius, kept outside the scene graph and placed by `useSunFx` each frame. It sits just inside the drawn Sun, so geometry in front occludes it. Its opacity comes from `godRayOpacity`: visible fraction, eased down to 0.3 as the Sun grows toward 5 degrees, because full-strength rays washed out a close-up disc. Partial occlusion depends on the depth buffer, which uses the same log-depth formula as other library consumers; full occlusion is covered by the float64 visibility.

## Data and debug attributes

On `.scene`:

| Attribute | Value |
|---|---|
| `data-quality` | Effective level: `high`, `medium` or `low` |
| `data-quality-mode` | `auto`, `high`, `medium` or `low` |
| `data-fx` | Active passes in order, comma separated |
| `data-textures-ready` | Existing texture readiness flag |

Dev-only hooks: `window.__svPasses()` returns the effect names per `EffectPass`; `window.__svRenderInfo()` returns the renderer's texture, geometry and program counts (used by the toggle leak test).

URL parameters: `quality=auto|high|medium|low` and `fx=0|1`. Keys: **Q** cycles Auto/High/Medium/Low, **E** toggles Camera effects (not while typing in a field). Golden views force `quality=high&fx=1`; everyday e2e tests use `quality=low` because SwiftShader is slow.

## Performance (development machine)

Measured 2026-10-07 with `npm run perf`: Chromium (Playwright, headless, ANGLE Direct3D 11) on a real GPU, 1600x900, device pixel ratio 1, Earth golden view (`dist=36000`, `fx=1`), 5 s after a 3 s settle. The probe did not fall back to SwiftShader, so no `headless: false` or `channel` change was needed.

GPU: Intel(R) UHD Graphics (device 0xA78B), an integrated GPU.

| Preset | Median | p95 | Frames in 5 s |
|---|---|---|---|
| High | 116.7 ms | 150.1 ms | 43 |
| Medium | 100.0 ms | 116.7 ms | 51 |
| Low | 16.7 ms | 33.3 ms | 274 |

Frame times are quantised to the 60 Hz vsync step of 16.7 ms.

Auto, starting at High, `data-quality` every 500 ms for 20 s: `high` for 2 s, `medium` for 4.5 s, then `low` for the rest. Two downward steps, no oscillation. It settles at Low, the only preset at vsync (16.7 ms) here.

Targets (spec §1): High under 16.7 ms median on a desktop GPU; Medium under 16.7 ms on a mid-range laptop. This machine has an integrated Intel UHD GPU, below both reference classes, and High and Medium miss by a wide margin. The numbers are still useful for relative cost, but they do not show whether a discrete desktop GPU meets the High target. That is unmeasured.

### Where the time goes at High

Passes were removed one at a time (a temporary local filter on `activePasses`, not committed), same view and settings. Medians over 5 s:

| Configuration | Median |
|---|---|
| All passes (High) | 100.1 ms |
| Without rays and flare | 66.7 ms |
| Without depth of field | 83.3 ms |
| Without streaks | 99.9 ms |
| Without chromatic aberration, grain, vignette | 100.0 ms |
| Without exposure | 100.0 ms |
| Only bloom and tone mapping (`fx=0`, High) | 33.3 ms |
| Only bloom and tone mapping (`fx=0`, Medium) | 33.3 ms |

The most expensive pass is god rays plus lens flare (about 33 ms), then depth of field (about 17 ms). Streaks, the display pass and exposure are within the quantisation noise. Even with effects off the scene needs about 33 ms here, so the base scene (shaders, 192-segment spheres, atmosphere samples) already misses 16.7 ms on this GPU, independent of the stack. Run-to-run variation was visible (the first High run read 116.7 ms and the repeat 100.1 ms), so treat each figure as about one vsync step. No preset was changed. Candidates for a later round: a lower-resolution or lower-sample god-ray pass and a half-resolution depth of field.
