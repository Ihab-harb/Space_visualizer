---
title: M2a.1 carry-over items for M2a.2
date: 2026-10-05
status: open (M2a.2 items marked done; remainder for M2a.3 and later)
milestone: M2a.2
tags: [plan, m2a, backlog]
---

# M2a.1 carry-over items for M2a.2

Back to [[Home]] · From [[2026-10-04-m2a1-imagery-and-shading]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]]

These items came out of the M2a.1 reviews (per-task reviews and the final whole-branch review). None blocked the M2a.1 merge. The M2a.2 plan should pick up the first two groups explicitly.

## Must do at the start of M2a.2 (before runtime quality switching)

- **Done in M2a.2.** **Tier changes flicker or blank.** `useTieredTexture` sets the texture to null when `maxTier` changes, so every body (Earth goes black) and the sky blank until the new tier loads. Keep the old texture until its replacement is committed.
- **Done in M2a.2.** **Texture cache reference leak on tier change.** The hook's `owned` set can hold one entry for two cache references when a tier change resolves straight from the cache. The result is a bounded GPU leak. Count references per texture, or release the duplicate immediately. Add hook-level tests: superseding, StrictMode, and a cache hit on a tier change.
- **Done in M2a.2 (build-time virtual module).** **HD tiers on static hosts.** Committed `imagery.json` lists git-ignored 4k/8k tiers for Earth, Mars, Mercury and the sky. On a static host they return 404 and Chrome logs a console error. The quality controller must only request HD tiers that a local manifest confirms exist.

## Effects, quality and interface (spec §4–§5, deliberately left to M2a.2)

- **Done in M2a.2 (AgX, [[0007-tone-mapping-and-exposure]]).** **Tone mapping.** EffectComposer forces `NoToneMapping`, so HDR clips (the Earth limb saturates to white). Add a ToneMapping effect.
- **Label occlusion and clutter.** Labels of far bodies draw over nearer discs, and inner-planet labels overlap in the overview.
- **Phone layout.** The info panel covers most of the body (for example Jupiter in the phone golden view). The drawer becomes a sheet in M2a.2.
- **Done in M2a.2** (stars dim with exposure; flare and rays checked on golden `3c-sun-far`; Saturn golden near equinox). **Golden views.** Stars should dim near the Sun, the Sun view needs lens flare and god rays, and the Saturn view should use a date near equinox.
- **Look tuning (mostly done in M2a.2 Task 9, see [[0007-tone-mapping-and-exposure]]).** Addressed: the cinematic fill, the unlit ring face (`RING_UNLIT_SCALE`), the dark ring at the Sun's limb (`CORONA_GAIN`), the ocean glint, and the cloud-shadow darkness and offset (with the 1/cos(lat) term; shadows still do not read over ocean, see "From M2a.2"). Still open: the ring slant correction, the atmosphere grazing-height brightening (pale day-limb line on Mars) and the "illustrative" label on Black Marble lights. Original list:
  - the cinematic fill (Venus and Mercury night sides read as blue-grey);
  - the unlit ring face is only about 0.65× as bright as the lit face;
  - the ring opacity has no slant correction (1 − e^(−τ/μ));
  - a dark ring shows at the Sun's limb, where the limb is darker than the corona just outside it;
  - the ocean glint is a hard hotspot;
  - cloud shadows are barely visible (and lack a 1/cos(lat) correction);
  - the atmosphere sky branch over-brightens at grazing heights (pale day-limb line on Mars);
  - Black Marble lights get a warm tint with no "illustrative" label.
- **Partly done in M2a.2** (Low and Medium request 1k and 2k only; High requests only tiers present). **Startup cost.** All 2k textures load at startup, even for bodies a few pixels wide, and total GPU memory is about 200 MB at the 2k default. Address both with adaptive quality; KTX2 stays deferred per [[0006-webp-tiers-ktx2-deferred]].

## Spec items not yet covered

- **Sun:** illustrative sunspot patches (spec §6).
- **Pipeline:** download checksums (spec §6). Only size checks exist today.

## Pipeline hardening (small)

- **`fetchBinary`:**
  - `meta.url` is not compared on a cache hit;
  - a Content-Length check with content-encoding can give a false failure;
  - cache names with subfolders are not created;
  - the response body is not cancelled on a non-OK status;
  - there are no HTTP-error tests;
  - `verifySources` has no HEAD timeout and does not compare against `approxBytes`.
- **Signed TIFF reader:**
  - the IFD read results are unchecked;
  - only the first SampleFormat value is read;
  - the edge-case tests are thin (big-endian, multi-row strips).
- **No per-product checks** for orientation or aspect on Black Marble, Viking, OPAL and clouds. Sources are resized with `fit: 'fill'`.
- **Tests:**
  - `derive` edge cases: `calibrateMask` with empty lists, `rollColumns` with a 0 shift;
  - a synthetic EXR test for the star-map decoder;
  - schema rejection tests;
  - a test that `sky` is absent from `bodies.json`;
  - unit tests for `committedBytes` and the budget gate.

## Runtime polish (small)

- **Uniforms and shader inputs:**
  - uniforms are mutated in the render body (Rocky, Sky);
  - `pickOccluders` allocates per frame and ranks by distance rather than angular size (revisit when moons arrive in M2b);
  - the `FRAG_HEADER` contract (the varyings a custom vertex shader must write) is undocumented.
- **Correctness edge cases:**
  - Earth has no fallback colour before its 1k tier loads, and `uReady` is dead code;
  - in the camera override, `azSun` silently falls back to `[0,0,0]` if a body position is missing;
  - `TextureReadiness` can report ready before loads start;
  - golden specs swallow the readiness timeout;
  - the TS `sunVisibleFraction` is not clamped near contact (the GLSL is).
- **Missing tests:**
  - no permanent e2e sky-orientation guard (a reviewer's render check matched Vega, Arcturus, Sirius and Capella within 2 px);
  - no GLSL/TS ring-shadow parity test;
  - no test for Saturn rings in the Imagery section;
  - no negative test for the cloud-drift note.
- **Giants and rings:** the gas-giant limb haze ignores eclipses and ring shadows, and Uranus's sub-texel rings alias into dots.
- **Docs:** `Architecture/pipeline.md` says 13.1 MB committed; it is now 12.9 MB.

## From M2a.2

Created or deferred during [[2026-10-05-m2a2-cinematic-effects-and-quality]]. Details in [[render]] and [[0007-tone-mapping-and-exposure]].

- **Cloud shadows (M2b Earth chapters).** The checklist item "offset cloud shadows visible" was waived for golden 1: its day side is ocean dominated by atmospheric in-scatter, so shadows cannot read unless in-scatter is dimmed under cloud shadow. That is a model change.
- **Grazing-limb hatched patch.** A hatched bright patch where the limb glow meets the night side. Unexplained, independent of autoClear; the dashed highlight on Earth's upper limb is probably the atmosphere shell silhouette.
- **GodRays autoClear warning.** The console warns that GodRays needs `<EffectComposer autoClear={false}>`. Adopting it hid the god-ray proxy behind the Sun mesh and added a square artifact, so it is not adopted. Revisit with a library update or a custom god-ray pass.
- **Composer remount workaround.** `EffectComposer` is keyed on the pass list and remounts on every selection, quality or fx change, to avoid a stale depth-of-field frame. It causes a rebuild hitch and could leak GPU resources (the Task 8 toggle test showed none). Find the root cause in `@react-three/postprocessing`.
- **Performance on integrated GPUs.** On an Intel UHD, High is about 100-117 ms and Medium about 100 ms median; Auto settles at Low. God rays plus flare cost about 33 ms and depth of field about 17 ms; even with effects off the scene needs about 33 ms. Candidates: lower-resolution god rays, half-resolution DoF, cheaper base shaders. Not measured on a discrete GPU.
- **Auto quality.** The step-up rule can cycle about every 15 s when the next level up is over 18 ms (add back-off); per-frame allocation and sort in the median; `fastSince` survives tab-hidden gaps; the controller is not resynced if `setLevel` is called elsewhere in Auto.
- **Q and E keys.** Not filtered for Ctrl, Cmd or Alt, nor for key auto-repeat (rapid composer remounts).
- **Streaks and rays.** Streaks read as a soft glow rather than crisp lines; god-ray depth masking (partial occlusion) may be affected by the log-depth formula; Saturn's far side is soft because the DoF focus range ignores body radius.
- **Tests and cleanup.** No regression test for the flare opacity inversion; the `maxExcess` streak test is string-match only; forced-preset e2e checks attributes only; no Medium assembly e2e; layout e2e relies on a 500 ms wait; `useSunFx` leaves effect values stale if the Sun is missing; per-frame allocations in `EffectsStack` and `useSunFx`; the CoC patch string compare runs every frame; atmosphere intensity 0.45 also dims the effects-off view.
- **Loader.** `vite build` with the virtual tier module is not exercised by a test; the plugin has no watch (restart dev after `textures:hd`); `useTieredTexture` unmount cleanup depends on `releaseAll([cache])`.
- **Dev warnings.** `THREE.Clock` deprecation warning from a dependency; Vite warns that the config imports `./pipeline/vite/localTiers` without an extension.
