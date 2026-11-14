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
| `quality.ts` | `PRESETS` (spec §5 table), `pixelRatioFor`, `canvasDpr`, `stepDown`/`stepUp`, `initialLevel`, `activePasses(level, effects)` |
| `autoQuality.ts` | The Auto controller: warm-up, median window, step down/up, cooldown, sustained long frames, step-up back-off; `resyncAuto` |
| `QualityGovernor.tsx` | Feeds frame times to the controller and writes the level to `renderStore`; installs `window.__svRenderInfo` (dev) |
| `RenderStateAttributes.tsx` | Writes `data-quality`, `data-quality-mode` and `data-fx` on `.scene` |
| `useMaxTier.ts` | Highest texture tier the level allows, or the `?tier=` override. It does not check the build: `availableRef` (`scene/textures/availableTiers.ts`) drops HD tiers the build does not contain |
| `EffectsStack.tsx` | Builds the `EffectComposer` and its passes in order; installs `window.__svPasses` and `window.__svComposer` (dev) |
| `passSegments.ts` | `segmentByAttributes` splits the effect list into runs so `EffectPass` does not reorder them; `composerGroups` adds the display pass only when chromatic aberration needs it |
| `sunFx.ts` | Per-frame Sun effects driver: god-ray proxy, flare occlusion, exposure targets |
| `exposure.ts` | Pure rules: `sunFrameWeight`, `sceneExposure`, `godRayOpacity`, `flareOpacity`, `damp` |
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
- **No MSAA backbuffer.** The Canvas is created with `antialias: false`. The composer multisamples its own buffers (4 samples at High and Medium, none at Low), so a multisampled backbuffer would only cost memory and a resolve.

### Auto rules

From spec §5: after a 3 s warm-up the controller measures the median frame time over a 2 s window. It steps down above 18 ms, steps up after 10 s below 12 ms, and waits 5 s after any change. Constants are in `AUTO_QUALITY`. Rulings from the M2a.2 final review:

- **Long frames.** A frame over 250 ms never enters the median: one such frame is a hitch, a tab switch or a debugger pause. Long frames that persist are evidence, though. Three in a row, or more than 1 s of them (at least two) within the 2 s window, drop the level **straight to Low**. This rule ignores the warm-up but not the cooldown, because the rebuild after a change compiles shaders in a few long frames. A frame longer than the whole window is a pause, not rendering, and never counts. Without this rule, a renderer at about 1 fps (SwiftShader, a VM, remote desktop) never filled the window and stayed at High.
- **Hidden page.** `QualityGovernor` passes `document.visibilityState === 'visible'` with each frame. Hidden frames never count. Like any gap, they restart the 10 s "fast" hold, so a hidden tab cannot leave a stale step-up behind.
- **Back-off.** If a step-up is reversed (stepped back down) within cooldown + window (7 s), that level is blocked for the rest of the session, until the mode changes or the page reloads. Without it, Medium at 8.3 ms and High at 25 ms on a 120 Hz display cycled every 15 s.
- **Entering Auto** resets the level to `initialLevel` (High on a desktop, Low on a phone), and the governor starts a fresh controller from it. If the level changes in Auto from anything other than the controller, the governor restarts the controller from that level (`resyncAuto`).
- **No headroom below vsync.** Frame times come from `requestAnimationFrame` deltas, which the browser caps at the display's refresh interval (16.7 ms at 60 Hz). The "under 12 ms" step-up rule can therefore only fire on displays faster than about 83 Hz. That is why entering Auto starts high and steps down, rather than starting low. GPU timer queries (`EXT_disjoint_timer_query_webgl2`) could measure real headroom later.
- **"Settles".** Spec §7 asks that Auto settle within 5 s. A two-step descent cannot: the warm-up (3 s) plus one cooldown (5 s) make it take at least 8 s. The perf probe therefore checks two things over a 20 s trace (`analyseAutoLevels`): the level did not change in the last 5 s, and it never reversed direction.

## Pass order and toggles

Order (plan Global Constraints): bloom, god rays and lens flare, anamorphic streaks, depth of field, exposure, tone mapping, chromatic aberration, vignette, grain. `activePasses` returns the passes the composer mounts. `data-fx` is the same list, comma separated, and the assembly e2e tests check that it equals the composer's passes.

- **Camera effects off** (key E, `?fx=0`): only bloom (reduced strength) and Neutral tone mapping, and the cinematic fill is off.
- **Depth of field** is mounted whenever the level has detail effects (High and Medium) and camera effects are on, whether or not a body is selected. It needs a focus point, so without a selection its blend opacity is 0, which passes the input through exactly. (`bokehScale` 0 would not: the effect adds its far-field term unscaled.) It still costs its pass, but selecting or deselecting no longer changes the pass list, so the composer is not rebuilt. `data-fx` lists `dof` whenever the pass is mounted, active or neutral.
- **Low** has no rays, flare, streaks, DoF, chromatic aberration or grain; vignette stays.

How the passes are assembled in three.js (all rulings from the M2a.2 ledger):

- When chromatic aberration is present, the display effects (chromatic aberration, vignette, grain) sit in their own `EffectPass` after tone mapping: merged into the HDR pass, chromatic aberration sampled untonemapped values. Without it (Low), vignette is per-pixel and merges into the HDR pass (`composerGroups`), so Low is a single `EffectPass`.
- `EffectPass` re-sorts merged effects by attribute, so `segmentByAttributes` turns each non-increasing run into its own `EffectGroup`. At High the result is `[bloom] [rays, flare] [streaks] [dof, exposure, tonemap] [display]`. One convolution effect per pass is a library rule.
- The stock circle-of-confusion shader mishandles our logarithmic depth buffer (it blurred the planet and left the sky sharp), so `patchCocForLogDepth` rewrites it.
- The `EffectComposer` is keyed on the pass list, so it remounts whenever the list changes. This is a workaround for a stale depth-of-field frame left after the DoF pass is removed; the root cause in `@react-three/postprocessing` was not found. Since depth of field stays mounted, only quality and camera-effects changes remount the composer, not selection. A remount disposes and rebuilds every render target and program. Before this change, selecting or deselecting Earth at High cost a 367 ms frame (median of six), against 117 ms steady state (see Performance).
- `autoClear={false}` on the composer is not adopted, although GodRays logs a warning asking for it: it hid the god-ray proxy behind the Sun mesh and added a square artifact. See [[0007-tone-mapping-and-exposure]]. Keeping it on is also why bodies do not mask the rays (see God-ray proxy).
- Tone mapping is AgX (compared with ACES in [[0007-tone-mapping-and-exposure]]).

Frame order (`useFrame` priority): FrameDriver -2, CameraSystem -1, BodyMesh -0.5, body uniforms -0.4, Sun effects -0.3, other components 0, and the composer renders at `renderPriority` 1.

## Scene-driven exposure

Exposure is not metered from the image. `sunFrameWeight` combines the Sun's visible fraction (float64, from the core) with how far inside the frame it is (fading out between NDC edge 1 and 1.3). `sceneExposure` turns that weight and the Sun's angular size into an exposure dip (0.15 for a small Sun up to 0.6 at 5 degrees) and a star-dimming factor (stars fall to 0.4 at full weight). Both are damped (lambda 4). `ExposureEffect` applies the multiplier before tone mapping; `Sky` applies the dimming.

## Sun occlusion from core

Lens-flare occlusion does not use the `<LensFlare>` raycast. `useSunFx` calls `sunVisibilityFromObserver` (float64, render radii) from the camera, so a planet crossing the Sun fades the flare exactly as the eclipse code would. The library's flare shader inverts opacity (`mix(flare, 0, opacity)`), so the flare is driven with opacity = 1 - weight.

## God-ray proxy

The god-ray source is a sphere at 0.98 of the Sun's render radius, kept outside the scene graph and placed by `useSunFx` each frame. Its opacity comes from `godRayOpacity`: visible fraction, eased down to 0.3 as the Sun grows toward 5 degrees, because full-strength rays washed out a close-up disc.

**Bodies do not mask the rays today; only the float64 opacity dims them.** That opacity covers full occlusion. With the Sun partly behind a limb, though, rays from the hidden part are drawn across the planet.

The cause is not the depth format. `GodRaysEffect` (postprocessing 6.39.5) copies the scene's raw depth into its light target with `gl_FragDepth`, then draws the proxy against it with a hardware depth test. Both are log depth, so the comparison is consistent. But the composer runs with `autoClear` true, so three's `renderer.render` clears that target's depth (WebGLBackground, `three.module.js` lines 1385-1393) before the proxy is drawn. The depth-mask material with the `a + b/d` conversion belongs to `SelectiveBloomEffect`, which this app does not use.

A temporary partial-occlusion view measured the effect: Earth at 20,000 km, Sun at the upper limb, `el=18.3` and `18.6`. The rays added 2.3 and 3.8 grey levels over the upper disc. With `autoClear={false}` and the proxy at 1.02 of the Sun's radius (so the Sun's own mesh cannot hide it), they added 0 and 0.3 grey levels. The unoccluded glow around the Sun, in the far-Sun and overview views, stayed within about 1 grey level. That change reverses the `autoClear` choice in [[0007-tone-mapping-and-exposure]], so it waits for a ruling (see the carry-over note).

## Data and debug attributes

On `.scene`:

| Attribute | Value |
|---|---|
| `data-quality` | Effective level: `high`, `medium` or `low` |
| `data-quality-mode` | `auto`, `high`, `medium` or `low` |
| `data-fx` | Mounted passes in order, comma separated (`dof` is listed while it is neutral) |
| `data-textures-ready` | Existing texture readiness flag |

Dev-only hooks: `window.__svPasses()` returns the effect names per `EffectPass`; `window.__svComposer()` returns the current `EffectComposer`, so a test can tell a rebuild from a kept composer; `window.__svRenderInfo()` returns the renderer's texture, geometry and program counts (used by the toggle leak test).

URL parameters: `quality=auto|high|medium|low` and `fx=0|1`. Keys: **Q** cycles Auto/High/Medium/Low, **E** toggles Camera effects. Neither key acts while typing in a field, with Ctrl, Cmd or Alt held, or on key auto-repeat. Golden views force `quality=high&fx=1`; everyday e2e tests use `quality=low` because SwiftShader is slow.

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

**Re-run after the final-review fixes** (same day, same machine and settings):

| Preset | Median | p95 | Frames in 5 s |
|---|---|---|---|
| High | 100.1 ms | 116.8 ms | 49 |
| Medium | 100.0 ms | 100.1 ms | 52 |
| Low | 16.7 ms | 16.7 ms | 301 |

Auto: `high` for 1.5 s, `medium` for 4.5 s, then `low`. It took the same two median steps as before; the long-frame rule did not fire, since no frame here exceeds 250 ms.

**Select/deselect hitch.** The probe selects and deselects Earth three times each at High (Earth view, Earth selected at the start). For each, it records the longest frame within 1 s after the click and, as a baseline, the longest frame in the 1 s before:

| Build | Longest frame after (median of 6) | Baseline before (median of 6) |
|---|---|---|
| Before (DoF joined and left the pass list) | 367 ms (select 333, 333, 333; deselect 400, 367, 383) | 117 ms |
| After (DoF stays mounted, neutral without a selection) | 116.7 ms (all six 116.7) | 116.7 ms |

The 250 ms excess was the composer rebuild. That is over the 100 ms ruling threshold, so depth of field now stays mounted (see Pass order and toggles).

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
