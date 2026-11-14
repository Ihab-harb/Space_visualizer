---
title: M2a.1 carry-over items for M2a.2
date: 2026-10-05
status: open
milestone: M2a.2
tags: [plan, m2a, backlog]
---

# M2a.1 carry-over items for M2a.2

Back to [[Home]] · From [[2026-10-04-m2a1-imagery-and-shading]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]]

These items came out of the M2a.1 reviews (per-task reviews and the final whole-branch review). None blocked the M2a.1 merge. The M2a.2 plan should pick up the first two groups explicitly.

## Must do at the start of M2a.2 (before runtime quality switching)

- **Tier changes flicker or blank.** `useTieredTexture` sets the texture to null when `maxTier` changes, so every body (Earth goes black) and the sky blank until the new tier loads. Keep the old texture until its replacement is committed.
- **Texture cache reference leak on tier change.** The hook's `owned` set can hold one entry for two cache references when a tier change resolves straight from the cache. The result is a bounded GPU leak. Count references per texture, or release the duplicate immediately. Add hook-level tests: superseding, StrictMode, and a cache hit on a tier change.
- **HD tiers on static hosts.** Committed `imagery.json` lists git-ignored 4k/8k tiers for Earth, Mars, Mercury and the sky. On a static host they return 404 and Chrome logs a console error. The quality controller must only request HD tiers that a local manifest confirms exist.

## Effects, quality and interface (spec §4–§5, deliberately left to M2a.2)

- **Tone mapping.** EffectComposer forces `NoToneMapping`, so HDR clips (the Earth limb saturates to white). Add a ToneMapping effect.
- **Label occlusion and clutter.** Labels of far bodies draw over nearer discs, and inner-planet labels overlap in the overview.
- **Phone layout.** The info panel covers most of the body (for example Jupiter in the phone golden view). The drawer becomes a sheet in M2a.2.
- **Golden views.** Stars should dim near the Sun, the Sun view needs lens flare and god rays, and the Saturn view should use a date near equinox.
- **Look tuning, which affects the overall look:**
  - the cinematic fill (Venus and Mercury night sides read as blue-grey);
  - the unlit ring face is only about 0.65× as bright as the lit face;
  - the ring opacity has no slant correction (1 − e^(−τ/μ));
  - a dark ring shows at the Sun's limb, where the limb is darker than the corona just outside it;
  - the ocean glint is a hard hotspot;
  - cloud shadows are barely visible (and lack a 1/cos(lat) correction);
  - the atmosphere sky branch over-brightens at grazing heights (pale day-limb line on Mars);
  - Black Marble lights get a warm tint with no "illustrative" label.
- **Startup cost.** All 2k textures load at startup, even for bodies a few pixels wide, and total GPU memory is about 200 MB at the 2k default. Address both with adaptive quality; KTX2 stays deferred per [[0006-webp-tiers-ktx2-deferred]].

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
