---
title: Changelog
tags: [log]
---

# Changelog

Back to [[Home]]

## 2026-10-04
- Design brainstormed and drafted: [[2026-10-04-solar-system-visualizer-design]].
- Vault structure set up: Home, Specs, Changelog.
- Spec approved. M1 implementation plan written: [[2026-10-04-m1-foundation]].
- Planning research: JPL Horizons checks showed JPL's published 1800–2050 accuracy for Neptune is optimistic (up to ~4.5× in direction, ~7× in distance), so the spec now requires showing measured accuracy. Rotation models will come from NASA NAIF's machine-readable `pck00011.tpc` (IAU 2015 values).

## 2026-10-04 — M1 Foundation implemented
- Sun and eight planets at real positions for any date (JPL approximate elements; error measured against JPL Horizons and shown in the app), IAU-oriented ellipsoids, orbit lines, labels.
- Orbit and Follow camera views (with "Rotate with body"), smooth log-distance transitions; Readable / True-scale modes.
- Time controls (real time to 1 year/s, reverse, go-to-date for −4712 to 9999, accuracy warnings).
- Info panel: NASA descriptions, physical and orbital facts, every value with a numbered citation and source list; live distances; accuracy lines.
- Data pipeline: JPL, NSSDCA, NAIF and NASA Science sources, validated; see [[pipeline]]. 280 unit tests, 5 end-to-end tests.
- Fixed during the visual check: labels stuck in a corner (frame ordering with drei Html), label roots remounting at startup, labels drawn over panels.
- Known limits: Earth drawn at the Earth–Moon barycentre (Moon arrives in M2); illustrative colours (official textures in M3).
## 2026-10-04 — M1 final review
- Independent review: ready with fixes, no critical issues. Fixed: co-rotating Follow kept the body upright (it used to rock by its axial tilt), the Sun's panel now shows distance and light time from Earth, light time never reads `8 min 60 s`, light time and accuracy figures carry citations, leaving Follow keeps orbiting the followed body, scrolling over labels zooms.
- Deferred minor items are listed in the M1 execution ledger and should be picked up in M2 planning.

## 2026-10-04 — Repository docs
- Added `README.md` (project description, quick start, data sources) and `docs/SETUP.md` (requirements, running, testing, refreshing data, troubleshooting). Set the GitHub repository description and topics.

## 2026-10-04 — M2 design
- Feedback after M1: richer per-body detail first, and much more advanced graphics (reference: sael.net and advanced Opus 5.5 projects).
- Brainstormed and drafted [[2026-10-04-m2-cinematic-and-rich-bodies-design]]: M2a cinematic graphics and Realistic mode, M2b rich body detail, M2c Exhibit mode; later milestones renumbered M3–M7.
- M2 spec approved.

## 2026-10-05 — M2a.1 plan
- Wrote [[2026-10-04-m2a1-imagery-and-shading]] (18 tasks). M2a is split in two: M2a.1 covers imagery and Realistic shading; M2a.2 will cover effects, adaptive quality and the new interface.
- Planning research:
  - verified every imagery source URL and size (Blue Marble, Black Marble, GEBCO, USGS Mars Viking/MOLA and Mercury MESSENGER, Hubble OPAL, NASA SVS Deep Star Maps);
  - worked out the star map's orientation from catalogue stars;
  - confirmed that three's EXR loader runs in Node;
  - confirmed that the NSSDCA ring fact sheets give official ring radii, optical depth and albedo.
- Scope rulings, recorded in the plan:
  - one Blue Marble month and the latest OPAL map per planet;
  - Moon imagery moves to M2b and the Venus radar view to M2a.2;
  - KTX2 is deferred (WebP tiers are used instead).

## 2026-10-05 — M2a.1 Imagery and Realistic shading implemented
- Official imagery from 13 sources (NASA Blue Marble, Black Marble, clouds, GEBCO; USGS Mars and Mercury; Hubble OPAL giant-planet maps; NASA Deep Star Maps sky), built into WebP tiers by `npm run textures` ([[0006-webp-tiers-ktx2-deferred]]). About 13.1 MB committed.
- Custom WebGL2 shaders per body type: terminator, Lommel-Seeliger and GGX, Earth night lights and cloud shadows, atmosphere scattering, eclipses ([[0005-webgl2-custom-shaders]]).
- Saturn and Uranus rings from NSSDCA ring tables with ring and planet shadows; illustrative Venus clouds, Sun surface and corona.
- NASA Deep Star Maps sky with credit.
- Shareable URL views (`jd`, `date`, `pause`, `target`, `dist`, `az`, `azSun`, `el`, `tier`).
- Info panel Imagery section: every layer cited, procedural visuals labelled illustrative.
- Six golden screenshots in `Assets/m2a1-golden/`; an e2e pixel guard on the Earth view. Details in [[scene]] and [[pipeline]].
- Final-review fixes: no impossible texture tiers (imagery.json lists only what the build produces; OPAL tiers never exceed their source width), a shared ref-counted texture cache (night, clouds and ring textures upload once), exaggerated relief labelled illustrative, Saturn outer ring edge is the cited F ring radius (139,826 km).

## 2026-10-05 — M2a.2 plan
- Wrote [[2026-10-05-m2a2-cinematic-effects-and-quality]] (10 tasks): the effects stack (bloom, god rays, lens flare, streaks, depth of field, exposure, filmic tone mapping, chromatic aberration, vignette, grain), the Camera-effects toggle, the High/Medium/Low/Auto quality presets with the frame-time controller, and the M2a.1 carry-over texture fixes.
- The remaining M2a scope is split into its own section, M2a.3: the interface redesign (spec §4), Tour mode and the Venus radar toggle. Each section gets its own PR.
- Planning research: postprocessing 6.39 supports the logarithmic depth buffer for depth of field and god rays. The built-in lens-flare occlusion raycast is unreliable at solar-system scale, so the plan computes Sun visibility in float64 in core.

## 2026-10-07 — M2a.2 Cinematic effects and adaptive quality implemented
- Post-processing stack: bloom, god rays and lens flare, anamorphic streaks, depth of field, scene-driven exposure, AgX tone mapping, chromatic aberration, vignette and grain. See [[render]].
- Quality presets (High, Medium, Low) and an Auto mode that follows spec §5; Quality control and Camera-effects toggle in the top bar, keys **Q** and **E**, URL parameters `quality=` and `fx=`. HD texture tiers are requested only if present in the build.
- [[0007-tone-mapping-and-exposure]]: AgX chosen over ACES, plus the exposure rule and two checklist waivers (cloud shadows in golden 1; flare and rays on the close-up Sun, checked on the far-Sun view instead).
- Real-GPU probe `npm run perf`. On this machine (integrated Intel UHD) Auto settles at Low; High and Medium miss 16.7 ms. God rays plus flare are the most expensive pass, then depth of field. Numbers in [[render]].
- Carry-overs for M2a.3 and M2b recorded in [[2026-10-05-m2a1-carry-over]].
- Final-review fixes:
  - Auto drops straight to Low on sustained long frames (it stayed at High at 1 fps). It backs off a step-up that is reversed, ignores hidden frames, and restarts from the initial level when Auto is entered.
  - A tier change loads the wanted tier directly, with no 1k flash.
  - Depth of field stays mounted, so selecting no longer rebuilds the composer: the hitch went from 367 ms to none.
  - Low runs as one pass, and the unused MSAA backbuffer is gone.
  - Q and E ignore modifier keys and auto-repeat.
  - God-ray masking by bodies was traced to the composer's `autoClear` and left for a ruling.
  - Details in [[render]].

## 2026-10-07 — M2a.3 plan written
- Implementation plan: [[2026-10-07-m2a3-interface-and-tour]], awaiting review. Twelve tasks:
  - the two M2a.2 residuals first: Auto dropping to Low on start-up hitches, and god rays not masked by bodies;
  - the spec §4 interface: header with cited chips and narrative, glass control panel, facts & sources drawer, bottom bar with timeline and Tour, decluttered pill labels;
  - Tour mode (spec §5);
  - the Venus Magellan radar view (USGS C3-MDIR mosaic, public domain, verified 2026-10-07);
  - phone layout and motion polish, then e2e coverage, goldens and docs.

## 2026-10-08 — M2a.3 Interface redesign, Tour and Venus radar implemented
- **Interface (spec §4):** a header that shows the overview or the selected body (cited chips and a narrative built only from cited facts), a frosted-glass control panel, a facts and sources drawer (**F**), a bottom bar with the date, time controls, Go to date, Tour button and a 1800-2050 timeline, and pill labels that declutter. Header and drawer share one citation numbering. Keys: **1**/**2**/**Esc**, **T** tour, **Q** quality, **E** effects, **F** drawer, all owned by `hotkeys.ts`. See [[ui]].
- **Tour:** the Sun, the planets by distance, then the overview: 5 s flights and 7 s dwells on the lit side, selecting each body. Any input exits; reduced motion means cuts; time is never changed. See [[camera]].
- **Venus radar:** the USGS Magellan C3-MDIR mosaic as a drawer toggle (`?radar=1`), labelled as radar and not visible light, with a Maxwell Montes orientation check (ratio 1.68). New source note [[USGS Venus Magellan C3-MDIR Mosaic]]; see [[pipeline]].
- **Phone layout:** compact header and bottom bar, the drawer as a sheet between them, a collapsible Controls dropdown; panels never overlap (layout tests at 1280x720 and 390x844).
- **M2a.2 residuals fixed first:** Auto counts only consecutive long frames and cannot drop in the first 5 s ([[render]]); god rays are masked by bodies (composer `autoClear={false}`, proxy at 1.02 R, golden `3d-sun-partial`; [[0007-tone-mapping-and-exposure]]).
- Twelve golden screenshots in `Assets/m2a3-golden/`; new end-to-end tests for the header, Tour, labels, the drawer and the layout matrix. Carry-over: [[2026-10-05-m2a1-carry-over]] (done items marked; "From M2a.3" lists what was deferred).
