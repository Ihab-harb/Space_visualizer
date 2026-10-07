---
title: Home
tags: [index]
---

# Solar System Visualizer

A 3D, time-accurate solar system in the browser — every fact cited to an official source — designed to grow to stars and galaxies.

## Specs
- [[2026-10-04-solar-system-visualizer-design|Design spec (2026-10-04)]] — approved
- [[2026-10-04-m2-cinematic-and-rich-bodies-design|M2 spec: cinematic graphics and rich bodies]] — approved

## Plans
- [[2026-10-04-m1-foundation|M1 Foundation]] — complete
- [[2026-10-04-m2a1-imagery-and-shading|M2a.1 Imagery and Realistic shading]] — complete
- [[2026-10-05-m2a1-carry-over|M2a.1 carry-over items]] — open, input to M2a.3
- [[2026-10-05-m2a2-cinematic-effects-and-quality|M2a.2 Cinematic effects and adaptive quality]] — complete
- [[2026-10-07-m2a3-interface-and-tour|M2a.3 Interface redesign, Tour and Venus radar]] — awaiting review

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
- [[Hubble OPAL Global Maps]]
- [[NASA SVS Deep Star Maps 2020]]
- [[NSSDCA Ring Fact Sheets]]

## Decisions
- [[0002-react-three-fiber]]
- [[0003-floating-origin-and-log-depth]]
- [[0004-measured-accuracy]]
- [[0005-webgl2-custom-shaders]]
- [[0006-webp-tiers-ktx2-deferred]]
- [[0007-tone-mapping-and-exposure]]

## Assets
- M2a.1 golden screenshots: `Assets/m2a1-golden/` (six PNG views)
- M2a.2 golden screenshots: `Assets/m2a2-golden/` (nine golden views plus the phone view, AgX, `quality=high&fx=1`)

## Log
- [[Changelog]]
