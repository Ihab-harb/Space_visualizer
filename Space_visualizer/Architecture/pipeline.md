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
