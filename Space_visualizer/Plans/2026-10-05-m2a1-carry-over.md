---
title: M2a.1 carry-over items for M2a.2
date: 2026-10-05
status: open (M2a.2 and M2a.3 items marked done; M2b and M2c items remain)
milestone: M2a.2
tags: [plan, m2a, backlog]
---

# M2a.1 carry-over items for M2a.2

Back to [[Home]] · From [[2026-10-04-m2a1-imagery-and-shading]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]]

These items came out of the M2a.1 reviews (per-task reviews and the final whole-branch review). None blocked the M2a.1 merge. The M2a.2 plan should pick up the first two groups explicitly.

## Must do at the start of M2a.2 (before runtime quality switching)

- **Done in M2a.2.** **Tier changes flicker or blank.** `useTieredTexture` sets the texture to null when `maxTier` changes, so every body (Earth goes black) and the sky blank until the new tier loads. Keep the old texture until its replacement is committed. (Final review: a tier change also skipped straight to 1k first, evicting the top tier; it now loads the wanted tier directly.)
- **Done in M2a.2.** **Texture cache reference leak on tier change.** The hook's `owned` set can hold one entry for two cache references when a tier change resolves straight from the cache. The result is a bounded GPU leak. Count references per texture, or release the duplicate immediately. Add hook-level tests: superseding, StrictMode, and a cache hit on a tier change. (The StrictMode test was missing until the M2a.2 final review added it.)
- **Done in M2a.2 (build-time virtual module).** **HD tiers on static hosts.** Committed `imagery.json` lists git-ignored 4k/8k tiers for Earth, Mars, Mercury and the sky. On a static host they return 404 and Chrome logs a console error. The quality controller must only request HD tiers that a local manifest confirms exist.

## Effects, quality and interface (spec §4–§5, deliberately left to M2a.2)

- **Done in M2a.2 (AgX, [[0007-tone-mapping-and-exposure]]).** **Tone mapping.** EffectComposer forces `NoToneMapping`, so HDR clips (the Earth limb saturates to white). Add a ToneMapping effect.
- **Done in M2a.3 (Task 8: pill labels, `labelLayout`, `useLabelDeclutter`).** **Label occlusion and clutter.** Labels of far bodies draw over nearer discs, and inner-planet labels overlap in the overview.
- **Done in M2a.3 (Tasks 6, 11: drawer as a bottom sheet, compact header and bottom bar, collapsible Controls).** **Phone layout.** The info panel covers most of the body (for example Jupiter in the phone golden view). The drawer becomes a sheet in M2a.3.
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

## Must do at the start of M2a.3 (both done in M2a.3 Tasks 1 and 2)

Residuals left open by the M2a.2 final review (no second fix wave was allowed). Both need doing before anything else.
- **Done in M2a.3 Task 1** (consecutive long frames only, cooldown from the first sample; render.md corrected). **Auto drops to Low on start-up hitches.** The re-review reproduced this on the dev machine in 4 of 4 page loads with `quality=auto`. Two shader-compile and upload hitches (about 900 ms and 450 ms, roughly 1 s apart) trip the long-frame rule within about 2 s. That rule ignores warm-up, and its ">1 s within the window" clause does not need the long frames to be consecutive. Auto also drops after Low → Q → Auto. Because a 60 Hz display can never step back up, a strong desktop can stay at Low for the whole session. **Fix:** count only *consecutive* long frames (≥3 in a row, or ≥2 in a row totalling >1 s), and start the cooldown at the first sample. Add unit tests for the measured hitch traces. Correct render.md, which wrongly says "the long-frame rule did not fire".
- **God rays are not masked by bodies. Done in M2a.3 Task 2** (composer `autoClear={false}`, proxy at 1.02 R, golden `3d-sun-partial` with a luminance assertion; see [[0007-tone-mapping-and-exposure]]). The candidate fix, found by the implementer and checked by the re-reviewer with route patches, is `EffectComposer autoClear={false}` plus a god-ray proxy at 1.02× the Sun's radius. It showed no square artifact; golden differences were at most 7 grey levels; the GodRays warning went away; and rays over the occluding planet dropped from 2.3–3.8 to 0–0.3 grey levels. It still needs: its own commit; the full e2e run (leak test, Earth guard, goldens); a partial-occlusion golden with a luminance assertion; and updates to Decision 0007, render.md and the composer comment.

## From M2a.2

Created or deferred during [[2026-10-05-m2a2-cinematic-effects-and-quality]]. Details in [[render]] and [[0007-tone-mapping-and-exposure]].

- **Cloud shadows (M2b Earth chapters).** The checklist item "offset cloud shadows visible" was waived for golden 1: its day side is ocean dominated by atmospheric in-scatter, so shadows cannot read unless in-scatter is dimmed under cloud shadow. That is a model change.
- **Grazing-limb hatched patch.** A hatched bright patch where the limb glow meets the night side. Unexplained, independent of autoClear; the dashed highlight on Earth's upper limb is probably the atmosphere shell silhouette.
- **GodRays autoClear warning. Done in M2a.3 Task 2:** the composer now runs with `autoClear={false}` and the warning is gone. The console used to warn that GodRays needs it; adopting it had hidden the proxy behind the Sun mesh, which the 1.02 R proxy fixes.
- **Composer remount workaround.** `EffectComposer` is keyed on the pass list and remounts on every quality or fx change, to avoid a stale depth-of-field frame. It causes a rebuild hitch and could leak GPU resources (the Task 8 toggle test showed none). Find the root cause in `@react-three/postprocessing`. **Selection no longer remounts it (final review):** depth of field stays mounted, neutral without a selection, after the probe measured a 367 ms hitch against 117 ms steady state.
- **Performance on integrated GPUs.** On an Intel UHD, High is about 100-117 ms and Medium about 100 ms median; Auto settles at Low. God rays plus flare cost about 33 ms and depth of field about 17 ms; even with effects off the scene needs about 33 ms. Candidates: lower-resolution god rays, half-resolution DoF, cheaper base shaders. Not measured on a discrete GPU.
- **Auto quality.** **Done in the final review:** sustained long frames drop straight to Low (Auto used to stay at High at 1 fps); back-off after a reversed step-up; `fastSince` resets on gaps and hidden frames; entering Auto resets the level to `initialLevel`; the controller is created lazily and resynced when `setLevel` is called elsewhere in Auto. Still open: per-frame allocation and sort in the median; rAF deltas cannot show headroom below vsync, so at 60 Hz Auto never steps up (GPU timer queries could); (**fixed in M2a.3 Task 1:** the long-frame rule now needs consecutive frames and a 5 s cooldown) the long-frame rule ignored the warm-up, so a strong GPU whose start-up (shader compiles, HD texture uploads) gives three frames over 250 ms in a row would drop to Low and, at 60 Hz, stay there. Not seen on the Intel UHD probe, which loads no HD tiers.
- **Done in the final review.** **Q and E keys.** Not filtered for Ctrl, Cmd or Alt, nor for key auto-repeat (rapid composer remounts).
- **Streaks and rays.** Streaks read as a soft glow rather than crisp lines. **God rays are not masked by bodies (fixed in M2a.3 Task 2):** the cause is the composer's default `autoClear`, which clears the depth `GodRaysEffect` copies into its light target. It is not the log-depth formula: `DepthMaskMaterial` belongs to `SelectiveBloomEffect`, which the app does not use. Partial occlusion therefore draws rays from the hidden part of the Sun across the planet; only the float64 opacity dims them. `autoClear={false}` with the proxy at 1.02 of the Sun's radius fixed it in a temporary test, but it reverses [[0007-tone-mapping-and-exposure]]; still to check: golden 3-sun, the earlier square artifact, the leak test. (The Saturn far-side softness was fixed by `DOF_RADIUS_RANGE`.)
- **Tests and cleanup.** The flare opacity inversion now has a regression test (`flareOpacity`, final review). The `maxExcess` streak test is string-match only; forced-preset e2e checks attributes only; no Medium assembly e2e; layout e2e relies on a 500 ms wait; `useSunFx` leaves effect values stale if the Sun is missing; per-frame allocations in `EffectsStack` and `useSunFx`; the CoC patch string compare runs every frame; atmosphere intensity 0.45 also dims the effects-off view.
- **Loader.** `vite build` with the virtual tier module is not exercised by a test; the plugin has no watch (restart dev after `textures:hd`); `useTieredTexture` unmount cleanup depends on `releaseAll([cache])`.
- **Display changes.** The Canvas pixel ratio goes stale when the window moves to a monitor with a different `devicePixelRatio` (deferred by the final review).
- **Dev warnings.** `THREE.Clock` deprecation warning from a dependency; Vite warns that the config imports `./pipeline/vite/localTiers` without an extension.

## From M2a.3

Deferred minor items from [[2026-10-07-m2a3-interface-and-tour]] (summarised from the execution ledger). The Venus radar view, the interface, the Tour and the phone layout are done; none of the items below blocked them.

- **Venus radar.** The Maxwell Montes box check (1k, 1.3×) may not catch a longitude mirror (an argmax near 3.6 E, 65 N would). No-data (0) pixels lower the global mean and render pure black (noted in the data source). No unit test for the atmosphere hiding or the `uRadar` gating.
- **Auto quality.** No regression test that the median step-down still fires between 3 s and 5 s, and none for a long run straddling the end of the start-up cooldown. `longWithinWindowMs` is now a run total (stale name). A garbled sentence in render.md ("three loads ... two loads"). The god-ray luminance assertion is glow-dominated (margin about 2.6 grey levels); a differential patch would discriminate better.
- **Header and narrative.** Rounding crosses boundaries (59.96 s shows "60.0 s", 119.6 min shows "120 min") and "1 hours" is possible. The narrative says "circles the Sun" for any non-star (wrong for moons; use `parentId` in M2b). Tests miss chip `[n]` equal to the `citationModel` numbers, Sun and Earth headers, and the bodies-in-view projection. The Facts button's visible label lacks "(F)".
- **Control panel.** Realistic is a focusable pressed button with no handler, and the disabled Exhibit button hides its "arrives in M2c" title from keyboard and touch users (use `aria-disabled`).
- **Drawer.** Focus is not moved into the drawer on open or restored on close. A highlight timeout is not cleaned up on unmount.
- **Bottom bar.** The 0-1000 slider is about 91 days per step, so a click without a drag quantises the date. Tick labels do not line up with the native thumb travel. "Outside 1800-2050" shows twice (note and status). Tests miss the outside-range note, the Stop-tour state and the published variable.
- **Labels.** The selected label can stay hidden up to about 350 ms (priority recomputed at 4 Hz). Declutter does not clip to the viewport, has no hysteresis, and panel-covered labels still compete. The label dot glow uses the text colour, not the body colour. Earth is hidden in the overview by the Sun's larger label (the priority rule); a bonus for Earth may be wanted.
- **Tour.** Exiting mid-flight pivots Orbit on the destination stop while the camera is still far. A null stop pose ends the tour instead of skipping the stop. One frame of input is dropped on exit. Reduced motion keeps the 4 degrees per second dwell rotation. Per-frame allocation in the tour path. Missing tests: mid-flight exit, start from Follow, reduced motion, a null pose. Space or Enter on the Tour button now stops the tour (fixed in the M2a.3 final review); on other focused buttons they act and also stop the tour, which is intended as user input.
- **Phone.** Footer, sky credit and tick labels are 10 px and header actions 12 px. "Show more" always renders, with a touch target of about 22 px. `controlsOpen` stays stale after resizing wider. The layout matrix now covers 800x1000, 1024x768 and 1100x800 as well as 390x844 and 1280x720. The layout specs use fixed waits (`waitForTimeout`), and the "topmost" check uses `elementFromPoint`, which is weak. No unit test for the `--header-bottom` publish or cleanup.
- **Housekeeping.** All goldens are recopied each section (grain-only churn). The `hotkeys.test.ts` describe title has a mangled section sign. `useHotkeys` reads tour state before checking the action. The 400 ms waits in the label e2e leave a small flake margin.

## From M2b.1 (Tasks 1–4, 2026-10-10)

These are minor findings from the per-task reviews, deferred for the whole-branch review after Task 10 to triage. They were copied here from the git-ignored execution ledger. Plan: [[2026-10-10-m2b1-body-details]].
- **Details schema and checks (Task 1):**
  - the test fixtures cite a generic fact-sheet source for Mars' missions and features;
  - an unused `_drop` destructure in `schema.test.ts`;
  - `validDate` relies on `Date.parse` for impossible dates; the schema's `z.iso.date()` is the real guard.
- **Fact-sheet parser (Task 2):**
  - reworded dipole tilt, longitude, offset, surface-field or pole lines silently become `null`; only strength and radius throw;
  - a reworded gas line without a "(Formula)" or "Symbol - n" shape falls into the notes instead of throwing;
  - dipole qualifiers are lost ("~0.1", "(IAU convention)", Saturn's quadrupole/octupole caveat);
  - Mercury's column-abundance ranges are dropped by design;
  - Uranus' magnetosphere is only asserted as not null;
  - `planetSheetUrl(id: string)` is not typed to the planet ids;
  - superscript conversion covers digits and ± only.
- **Zip, dBASE and Gazetteer (Task 3):**
  - commit `d4c023b` was made with one failing test, which `8df7755` fixed;
  - the dBASE reader is untested for numerics with leading spaces, short buffers and the version byte;
  - two zip tests (the ZIP64 per-entry sentinel and the cut-short stored entry) only check that some zip error is thrown, not which one;
  - Gazetteer latitudes and diameters keep the source's float noise;
  - a NaN latitude or longitude is not checked before the schema;
  - an `approvedYear` of "0000" becomes 0.
- **Quote checks (Task 4):**
  - a lower-case word before a day number still passes ("the probe 2 August 1977" counts as 1977-08-02);
  - "July of 1965", "July, 1965" and "summer 1965" pass the planned-launch year-only rule;
  - safe false fails: "Launched 20 August 1977", hostnames with a trailing dot, and a range after a capitalised word ("Earth 1,650-1,675 km" gives only 1675);
  - the 6-word minimum can be gamed;
  - `verifyInteriors` does not check min ≤ max;
  - the zero exemption applies to every range key.
