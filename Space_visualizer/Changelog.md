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
- **Phone layout:** compact header and bottom bar, the drawer as a sheet between them, a collapsible Controls dropdown; panels never overlap (layout tests at 390x844, 800x1000, 1024x768, 1100x800 and 1280x720; the control panel collapses behind Controls at 1140 px and narrower and the drawer sits under the header at 940 px and narrower).
- **Final review fixes:** the header and control panel no longer overlap at tablet widths; Space/Enter on the Tour button stops the tour; 2 during the tour ends in Follow; the Venus radar view is tagged on screen and its notes match what is shown; hotkeys work after the slider or a checkbox had focus; F needs a selection; header and drawer live values update at 4 Hz.
- **M2a.2 residuals fixed first:** Auto counts only consecutive long frames and cannot drop in the first 5 s ([[render]]); god rays are masked by bodies (composer `autoClear={false}`, proxy at 1.02 R, golden `3d-sun-partial`; [[0007-tone-mapping-and-exposure]]).
- Twelve golden screenshots in `Assets/m2a3-golden/`; new end-to-end tests for the header, Tour, labels, the drawer and the layout matrix. Carry-over: [[2026-10-05-m2a1-carry-over]] (done items marked; "From M2a.3" lists what was deferred).

## 2026-10-10 — Stacked PRs, M2b.1 design, and chat history in the vault
- **Pull requests:** M2a.2 and M2a.3 were pushed as stacked PRs, #3 (base `m2a1-imagery`) and #4 (base `m2a2-cinematic`). #2 stays M2a.1 only.
- **M2b split:** M2b (rich body detail) was brainstormed and split into five sections: M2b.1 data, M2b.2 the Moon, M2b.3 cutaway and charts, M2b.4 pins and fields, M2b.5 chapters.
- **M2b.1:** the spec [[2026-10-10-m2b1-body-details-design]] was approved, and the plan [[2026-10-10-m2b1-body-details]] was written after checking the real source formats. At the user's request, Tasks 1–4 were done first: the schema and checks, the fact-sheet parser, the Gazetteer readers and the quote checks.
- **Vault process:** `Sessions/` was started, because the user wants the chat history kept in the vault. [[Start here]] was added for new chats: goals, working agreements, process, environment and current state. Execution rulings are now copied into each plan's "Execution record" before scratch files are deleted.

## 2026-10-16 — M2b.1 Body details data implemented
- **Cited details for all nine bodies** (the Sun and eight planets), one file each in `public/data/solar-system/details/<id>.json`, loaded on demand when a body is selected and never at startup. Model and checks in `src/core/details` ([[core]]); the store in [[state]]; the drawer sections in [[ui]].
- **Content:**
  - **Interior:** layers for the Sun, Mercury, Earth and Mars from curated official pages, each with its source sentence checked by the build. The other five planets show none, because no official numeric source exists.
  - **Atmosphere** (all bodies, the Sun's photosphere included) and **magnetic field** (a dipole, "no global field" or a note) parsed from the NSSDCA fact sheets.
  - **Key missions:** 43 mission entries (39 distinct missions: Voyager 1 and 2 and a few others repeat across bodies), in launch order, from official NASA, ESA and JAXA pages, plus a discovery entry for every body except Earth and the Sun. Apollo 8 is not listed under Earth: it orbited the Moon, so it moves to the Moon in M2b.2.
  - **Named features:** the 200 largest approved Gazetteer features for Mercury, Venus and Mars (the drawer shows the top 10 and the total).
- **Pipeline:** fact-sheet parser, a zip and `.dbf` reader written in the repo (no dependency), the Gazetteer selector, the quoted-reference checks and `buildDetails`; see [[pipeline]]. The sources are [[NSSDCA Planet Fact Sheets]], [[USGS Gazetteer of Planetary Nomenclature]] and [[NASA mission and science pages (curated)]]. `npm run data` now also fetches about 12 MB of Gazetteer zips and the curated pages; `npm run data:offline` rebuilds from the cache.
- **Citations:** details sources are numbered after the existing ones, so no number shown before the details load ever changes. The header gains a cited details sentence (main gas, field). A moon now reads "orbits <parent>", not "circles the Sun" (carry-over item done).
- **Failure handling:** a missing or failing details file shows "Details unavailable" with Retry; the rest of the drawer keeps working.
- **Tests:** 690 unit tests (after the whole-branch fix wave); `e2e/details.spec.ts` (three end-to-end tests: no details request at startup, Mars shows all five cited sections, a blocked file shows the unavailable state). Screenshots in `Assets/m2b1/`.
- **Whole-branch review fixes:** the Interior rows show each bound in the form its source states it (for example Mars core "from radius 1,500–2,100 km to the centre", Sun core "from 25 % of the radius to the centre", Earth mantle "from 30 km deep to radius 3,485 km"), never a derived kilometre figure; each bound records its `from` and stated numbers in the data (the stored radii are unchanged for the M2b.3 cutaway); Mars' core state "liquid" now cites the InSight page. Numbers no longer gain digits (Mercury's dipole reads 0.002; ppm uncertainties read "± 1,000"). The header says "aligned with its spin axis" for a 0° tilt; Mercury's Atmosphere shows no column-abundance basis line. Each source page is listed once (four duplicate pairs merged), Gazetteer citations link the web page rather than the zip, Parker Solar Probe, Solar Orbiter, SOHO and Ulysses are typed orbiter as their pages say, and the Discovery line no longer shows the unquoted method.
- Carry-over: [[2026-10-05-m2a1-carry-over]] ("From M2b.1" lists what was deferred).
- **Pull request:** `m2b1-details` was pushed as PR #5, stacked on #4 (base `m2a3-interface`). The stack #1 → #5 is open and not merged.

## 2026-10-30 — M2b.2 The Moon implemented
- **The Moon at its real position** for 1800 to 2051: JPL Horizons geocentric vectors compressed to a Chebyshev table (16-day segments, degree 12, 1.88 MB), within 0.904 km (0.4792 arcsec) of Horizons on 366,720 held-out samples. Outside that range the JPL mean elements give the position; they are off by up to about 175 degrees at the far dates, and the app shows that number. Decision: [[0008-moon-chebyshev-table]]. Code: `chebyshev`, `meanElements`, `system`, `phase` in [[core]].
- **Earth moved off the barycentre:** it now sits at the Earth-Moon barycentre minus 0.0121506 times the Moon's offset (mass ratio from [[NAIF GM DE440]]). A new Earth centre check against Horizons reads 2,190 km (11.8 arcsec), which is Earth's own approximate-barycentre error.
- **Header and drawer:** subtitle "Moon of Earth · 384,400 km", a Phase chip, distances in km (`formatKm`), "The Moon orbits Earth every 27.3 days at an average 384,400 km" (no more "0.00 AU"), accuracy lines for the table and the mean elements, and citations for Earth's barycentre sources. See [[ui]].
- **Scene:** a lunar orbit line, a rule that hides a moon while readable-scale inflation puts it inside its parent's drawn disc, a 3 px minimum, a Tour stop; Lommel-Seeliger shading with relief, earthshine, a copper eclipse tint and an eclipse-aware atmosphere shell. See [[scene]].
- **Details:** exosphere number densities (9 gases, upper limits), crust, mantle and core from NASA's Moon pages, the Moon's weak field, 12 missions (Apollo 8 moved here), and the Gazetteer's largest Moon features. No Discovery section: no official sentence found.
- **Imagery:** [[NASA SVS CGI Moon Kit]] colour (LROC) and relief (LOLA, x2, illustrative); 17.5 MB committed. Reader fix: sharp rescaled unsigned 16-bit greys, so a repo reader handles them.
- **Sources and pipeline:** [[JPL Planetary Satellite Mean Elements]], [[NAIF GM DE440]], [[NSSDCA Moon Fact Sheet]]; `npm run moon:ephemeris` (about 20 minutes first run); the Horizons reference grew from 72 to 81 vectors. See [[pipeline]].
- **Tests:** 797 unit tests, typecheck clean, 93 end-to-end tests. Six Moon golden views in `Assets/m2b2/`, with the tuned shading values, in [[2026-10-29-m2b2-moon]].
- Not pushed yet; the whole-branch review is pending. Open questions are in [[2026-10-29-session-m2b2-moon]]. Carry-over: [[2026-10-05-m2a1-carry-over]] ("From M2b.2").

## 2026-10-30 — M2b.2 whole-branch review fixes
- The Moon is no longer hidden when Earth is behind it close up; hiding applies only when readable-scale inflation causes the overlap.
- Outside the Horizons table the Moon's distances, phase and light time cite the mean elements, and the status bar reads out of range.
- The Moon's orbit line uses one model, so it has no kink at the table edge.
- The held-out sample count is 366,720 (it counted samples past the table end before). Doc fixes in [[0008-moon-chebyshev-table]], [[core]] and [[scene]]. Details: [[2026-10-29-m2b2-moon]].
