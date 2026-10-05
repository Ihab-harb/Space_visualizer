---
title: pipeline
tags: [architecture]
---

# pipeline (`pipeline/`)

Back to [[Home]] · [[Overview]]

**Commands**
- `npm run data`: fetches every source, builds, validates, then writes `public/data/`.
- `npm run data:offline`: the same, using only the cached copies in `pipeline/raw/` (git-ignored).
- `npm run horizons:reference`: refreshes `pipeline/reference/horizons-heliocentric.json` (72 Horizons vectors).

**Flow:** fetch (with cache fallback) → parse (one parser per source) → build (`buildSolarSystem`) → validate (schemas, sources resolve, no duplicates) → write. If validation or fetching fails, `public/data` is left untouched and the error names the exact field.

**Measured accuracy:** the build compares each orbit table against the Horizons reference and stores `horizonsCheck` (sample count, maximum angular and distance error), which the info panel shows. See [[0004-measured-accuracy]].

**Sources:** [[JPL Approximate Positions of the Planets]] · [[JPL Horizons]] · [[NSSDCA Planetary Fact Sheet]] · [[NSSDCA Sun Fact Sheet]] · [[NAIF PCK00011]] · [[NASA Science pages]] · [[IERS leap seconds]] · [[NASA Delta T polynomials]]

## Textures

See [[0006-webp-tiers-ktx2-deferred]] and the M2 spec [[2026-10-04-m2-cinematic-and-rich-bodies-design]].

**Commands**
- `npm run textures`: downloads the source products into `pipeline/raw/textures/` (git-ignored, about 5 GB; a download interrupted part-way restarts from zero, because it is written to a temp file and renamed on completion) and builds the committed 1k/2k tiers in `public/textures/`. Reports "Imagery for 8 bodies from 13 sources".
- `npm run textures -- --offline`: rebuilds from the cache only.
- `npm run textures:hd`: also builds 4k and 8k locally (Node runs with an 8 GB heap).
- `npm run textures:verify`: checks that every source URL still responds.

**Modules (`pipeline/textures/`):** `manifest.ts` (the product list; every product is a `Source`), `fetchBinary.ts` (cached download), `rasters.ts` (read and resample; includes a signed 16-bit strip-TIFF reader behind `readBandFloat`, because sharp/libvips clamps signed int16 GeoTIFFs to 0, which broke the Mars elevation. It throws on BigTIFF, compressed, tiled or truncated files), `derive.ts` (normal maps, masks), `rings.ts` (ring radial profiles, 2048x2), `stars.ts` (sky), `build.ts` (tiers, budget) and `run.ts`.

**Tiers and budget:** 1k to 8k, always 2:1 equirectangular. Committed textures total about 13.1 MB against a 60 MB budget the validator enforces.

**Validations:** Earth Sahara versus Pacific brightness, Mars and Mercury DEM elevation ranges, Olympus Mons peak, sky orientation. A failed validation stops the build.

**Output:** `public/textures/imagery.json` (written by `build.ts`) is merged into `public/data` by `pipeline/run.ts` and attaches `imagery` to each body; `npm run data:offline` still writes 9 bodies and 27 sources.

**Sources:** [[NASA Blue Marble Next Generation]] · [[NASA Black Marble]] · [[NASA Blue Marble Clouds]] · [[NASA GEBCO Topography and Bathymetry]] · [[USGS Mars Viking Color Mosaic]] · [[USGS Mars MOLA DEM]] · [[USGS Mercury MESSENGER Mosaics]] · [[Hubble OPAL Global Maps]] · [[NASA SVS Deep Star Maps 2020]] · [[NSSDCA Ring Fact Sheets]]
