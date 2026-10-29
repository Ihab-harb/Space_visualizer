---
title: Home
tags: [index]
---

# Solar System Visualizer

A 3D, time-accurate solar system in the browser — every fact cited to an official source — designed to grow to stars and galaxies.

**New chat or new contributor? Read [[Start here]] first**, then the latest note in `Sessions/`. **Cloud session? Read [[Cloud sessions]] first.**

## Specs
- [[2026-10-04-solar-system-visualizer-design|Design spec (2026-10-04)]] — approved
- [[2026-10-04-m2-cinematic-and-rich-bodies-design|M2 spec: cinematic graphics and rich bodies]] — approved
- [[2026-10-10-m2b1-body-details-design|M2b.1 spec: body details data]] — approved
- [[2026-10-29-m2b2-moon-design|M2b.2 spec: the Moon]] — drafted for the user to review

## Plans
- [[2026-10-04-m1-foundation|M1 Foundation]] — complete
- [[2026-10-04-m2a1-imagery-and-shading|M2a.1 Imagery and Realistic shading]] — complete
- [[2026-10-05-m2a1-carry-over|M2a.1 carry-over items]] — open (M2a.3 items done; M2b and M2c items remain)
- [[2026-10-05-m2a2-cinematic-effects-and-quality|M2a.2 Cinematic effects and adaptive quality]] — complete
- [[2026-10-07-m2a3-interface-and-tour|M2a.3 Interface redesign, Tour and Venus radar]] — complete
- [[2026-10-10-m2b1-body-details|M2b.1 Body details data]] — complete
- [[2026-10-29-m2b2-moon|M2b.2 The Moon]] — complete (review pending)
- [[2026-10-16-cloud-sessions-setup|Cloud sessions setup]] — awaiting review
- [[2026-10-16-cloud-task-queue|Cloud task queue]] — open (jobs for cloud sessions)

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

## Decisions
- [[0002-react-three-fiber]]
- [[0003-floating-origin-and-log-depth]]
- [[0004-measured-accuracy]]
- [[0005-webgl2-custom-shaders]]
- [[0006-webp-tiers-ktx2-deferred]]
- [[0007-tone-mapping-and-exposure]]
- [[0008-moon-chebyshev-table]]

## Assets
- M2a.1 golden screenshots: `Assets/m2a1-golden/` (six PNG views)
- M2a.2 golden screenshots: `Assets/m2a2-golden/` (nine golden views plus the phone view, AgX, `quality=high&fx=1`)
- M2a.3 golden screenshots: `Assets/m2a3-golden/` (twelve views: the ten M2a.2 views redone with the new interface, plus `0b-venus-radar` and `5b-phone-drawer`; `quality=high&fx=1`)

- M2b.1 screenshots: `Assets/m2b1/` (Mars Interior and Atmosphere, Jupiter Magnetic field; each at 1280x720 and 390x844)
- M2b.2 golden screenshots: `Assets/m2b2/` (six Moon views: quarter, full, Earth and Moon, the 2024 solar eclipse, the 2025 lunar eclipse, overview with the Moon hidden; `quality=high&fx=1`)

## Log
- [[Changelog]]

## Sessions
Chat history with Claude Code: requests, decisions and open questions, one note per session.
- [[2026-10-04-session-m1-to-m2a3|2026-10-04 to 2026-10-16: M1 to M2b.1]]
- [[2026-10-29-session-m2b2-moon|2026-10-29 to 2026-10-30: M2b.2 the Moon]]
- [[2026-10-16-session-cloud-plan|2026-10-16: cloud sessions plan]]
- [[2026-10-29-session-vault-check|2026-10-29: vault check]]
