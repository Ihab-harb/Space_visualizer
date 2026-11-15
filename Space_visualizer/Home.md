---
title: Home
tags: [index]
---

# Solar System Visualizer

A 3D, time-accurate solar system in the browser — every fact cited to an official source — designed to grow to stars and galaxies.

**New chat or new contributor? Read [[Start here]] first**, then the latest note in `Sessions/`. (Cloud sessions are shelved since 2026-11-15; [[Cloud sessions]] is kept for reference.)

## Specs
- [[2026-10-04-solar-system-visualizer-design|Design spec (2026-10-04)]] — approved
- [[2026-10-04-m2-cinematic-and-rich-bodies-design|M2 spec: cinematic graphics and rich bodies]] — approved
- [[2026-10-10-m2b1-body-details-design|M2b.1 spec: body details data]] — approved
- [[2026-10-29-m2b2-moon-design|M2b.2 spec: the Moon]] — drafted for the user to review
- [[2026-10-30-m2b3-explore-interior-design|M2b.3 spec: Explore mode, interior cutaway and composition charts]] — approved
- [[2026-11-15-m2b4a-feature-pins-design|M2b.4a spec: feature pins]] — approved 2026-11-15, with "Amended while building" notes (§12a; mockups in `Assets/m2b4a/`)

## Plans
- [[2026-10-04-m1-foundation|M1 Foundation]] — complete (merged, PR #1)
- [[2026-10-04-m2a1-imagery-and-shading|M2a.1 Imagery and Realistic shading]] — complete (merged, PR #2)
- [[2026-10-05-m2a1-carry-over|M2a.1 carry-over items]] — open (M2a.3 items done; M2b and M2c items remain)
- [[2026-10-05-m2a2-cinematic-effects-and-quality|M2a.2 Cinematic effects and adaptive quality]] — complete (merged, PR #3)
- [[2026-10-07-m2a3-interface-and-tour|M2a.3 Interface redesign, Tour and Venus radar]] — complete (merged, PR #4)
- [[2026-10-10-m2b1-body-details|M2b.1 Body details data]] — complete (merged, PR #5)
- [[2026-10-29-m2b2-moon|M2b.2 The Moon]] — complete (merged, PR #6)
- [[2026-10-30-m2b3-explore-interior|M2b.3 Explore mode, interior cutaway and composition charts]] — complete (merged, PR #8)
- [[2026-11-15-m2b4a-feature-pins|M2b.4a Feature pins]] — complete on branch `m2b4a-pins` (eleven tasks, whole-branch review, fix wave and re-review done 2026-11-15); not pushed, no PR
- [[2026-10-16-cloud-sessions-setup|Cloud sessions setup]] — shelved
- [[2026-10-16-cloud-task-queue|Cloud task queue]] — shelved

## Architecture
- [[Overview]]
- [[core]]
- [[state]]
- [[scene]]
- [[render]]
- [[camera]]
- [[ui]]
- [[pipeline]]

## Data Sources
- [[JPL Approximate Positions of the Planets]]
- [[JPL Horizons]]
- [[NSSDCA Planetary Fact Sheet]]
- [[NSSDCA Sun Fact Sheet]]
- [[NAIF PCK00011]]
- [[NASA Science pages]]
- [[IERS leap seconds]]
- [[NASA Delta T polynomials]]
- [[NASA Blue Marble Next Generation]]
- [[NASA Black Marble]]
- [[NASA Blue Marble Clouds]]
- [[NASA GEBCO Topography and Bathymetry]]
- [[USGS Mars Viking Color Mosaic]]
- [[USGS Mars MOLA DEM]]
- [[USGS Mercury MESSENGER Mosaics]]
- [[USGS Venus Magellan C3-MDIR Mosaic]]
- [[Hubble OPAL Global Maps]]
- [[NASA SVS Deep Star Maps 2020]]
- [[NSSDCA Ring Fact Sheets]]
- [[NSSDCA Planet Fact Sheets]]
- [[USGS Gazetteer of Planetary Nomenclature]]
- [[NASA mission and science pages (curated)]]
- [[NASA SVS CGI Moon Kit]]
- [[JPL Planetary Satellite Mean Elements]]
- [[NAIF GM DE440]]
- [[NSSDCA Moon Fact Sheet]]
- [[Peer-reviewed papers (interior estimates)]]
- [[Earth names databases (GNIS, GNS)]]

## Decisions
- [[0002-react-three-fiber]]
- [[0003-floating-origin-and-log-depth]]
- [[0004-measured-accuracy]]
- [[0005-webgl2-custom-shaders]]
- [[0006-webp-tiers-ktx2-deferred]]
- [[0007-tone-mapping-and-exposure]]
- [[0008-moon-chebyshev-table]]
- [[0009-peer-reviewed-papers-for-estimates]]
- [[0010-names-databases-for-earth-positions]]

## Assets
- M2a.1 golden screenshots: `Assets/m2a1-golden/` (six PNG views)
- M2a.2 golden screenshots: `Assets/m2a2-golden/` (nine golden views plus the phone view, AgX, `quality=high&fx=1`)
- M2a.3 golden screenshots: `Assets/m2a3-golden/` (twelve views: the ten M2a.2 views redone with the new interface, plus `0b-venus-radar` and `5b-phone-drawer`; `quality=high&fx=1`)

- M2b.1 screenshots: `Assets/m2b1/` (Mars Interior and Atmosphere, Jupiter Magnetic field; each at 1280x720 and 390x844)
- M2b.2 golden screenshots: `Assets/m2b2/` (six Moon views: quarter, full, Earth and Moon, the 2024 solar eclipse, the 2025 lunar eclipse, overview with the Moon hidden; `quality=high&fx=1`)
- M2b.3 golden screenshots: `Assets/m2b3/` (eight Explore views: Earth Exploded, Earth Half-section, Jupiter Half-section, the Sun Exploded, the Moon Half-section, phone Earth Exploded, Saturn Half-section, Uranus Exploded; `quality=high&fx=1`, reduced motion; plus the three design mockups; all eight were re-shot in M2b.4a, because the Explore entry direction changed)
- M2b.4a golden screenshots: `Assets/m2b4a/` (six Surface views: Mars, the Moon with Tycho's card, Earth with North America, Venus radar, Mars with the list open, phone Mars; `quality=high&fx=1`, reduced motion; plus the two design mockups)

## Log
- [[Changelog]]

## Sessions
Chat history with Claude Code: requests, decisions and open questions, one note per session.
- [[2026-10-04-session-m1-to-m2a3|2026-10-04 to 2026-10-16: M1 to M2b.1]]
- [[2026-10-29-session-m2b2-moon|2026-10-29 to 2026-10-30: M2b.2 the Moon]]
- [[2026-10-30-session-m2b3-explore|2026-10-30 to 2026-11-06: M2b.3 Explore mode]]
- [[2026-11-15-session-m2b4-pins|2026-11-15: M2b.4 design talk and the M2b.4a feature pins build]]
- [[2026-10-16-session-cloud-plan|2026-10-16: cloud sessions plan]]
- [[2026-10-29-session-vault-check|2026-10-29: vault check]]
