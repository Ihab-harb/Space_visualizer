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
