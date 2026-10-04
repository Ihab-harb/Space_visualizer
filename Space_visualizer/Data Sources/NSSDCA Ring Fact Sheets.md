---
title: NSSDCA Ring Fact Sheets
publisher: NASA Goddard Space Flight Center, NSSDCA (D. R. Williams)
url: https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html
used-for: [Saturn and Uranus ring profiles and radii]
tags: [data-source]
---

# NSSDCA Ring Fact Sheets

Back to [[Home]]

- **Publisher:** NASA Goddard Space Flight Center, NSSDCA (D. R. Williams)
- **URL:** https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html
- **Source ids:** `nssdca-saturn-rings` (https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html) and `nssdca-uranus-rings` (https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranringfact.html)
- **Files used:** the two HTML fact sheets (cached as `satringfact.html` and `uranringfact.html`)
- **Feeds:** `rings` for Saturn and Uranus: a 2048x2 RGBA radial profile (lossless WebP) plus the `innerKm` and `outerKm` radii shown as cited values.
- **Derivation (from `build.ts`):** Radial profile built from the NSSDCA ring table (radii, optical depth, albedo); colour tint is illustrative. Bands below optical depth 0.01 are dropped; Uranus albedo values are in thousandths.
- **Validation:** the sheet parser throws if the table rows cannot be read; the ring radii are rounded km and sanity-checked only in a unit test (Saturn inner radius above 70000 km in `pipeline/build/buildSolarSystem.test.ts`), not by a build guard.
- **Licence:** NASA public domain (NASA media usage guidelines)
- **Accuracy / caveats:** Colours are illustrative; only radii and band structure come from the tables.
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)
