---
title: NASA GEBCO Topography and Bathymetry
publisher: NASA Earth Observatory / Visible Earth (GEBCO 2008 data)
url: https://visibleearth.nasa.gov/images/73934 and https://visibleearth.nasa.gov/images/73963
used-for: [Earth normal map and ocean mask]
tags: [data-source]
---

# NASA GEBCO Topography and Bathymetry

Back to [[Home]]

- **Publisher:** NASA Earth Observatory / Visible Earth (GEBCO 2008 data)
- **URL:** https://visibleearth.nasa.gov/images/73934 and https://visibleearth.nasa.gov/images/73963
- **Source ids:** `nasa-topography` (image 73934) and `nasa-bathymetry` (image 73963)
- **Files used:** `gebco_08_rev_elev_21600x10800.png` and `gebco_08_rev_bath_21600x10800.png`
- **Feeds:** Earth `normal` layer (topography) and Earth `specular` layer (bathymetry); tiers 1k/2k committed, 4k local.
- **Derivation (from `LAYER_JOBS`):**
  - normal: Normal map derived from GEBCO topography; relief exaggerated x8 for visibility (Earth radius 6371 km, 6400 m over the 0-255 range, strength 8). Written as lossless WebP.
  - specular: Ocean mask derived from GEBCO bathymetry (water = 1); drives sun glint. The mask threshold is calibrated from four known land points and four known water points, then written as lossless WebP.
- **Scope ruling:** the relief exaggeration is illustrative and labelled so in the UI. The 8-bit PNG limits vertical detail; it is for appearance, not elevation data.
- **Validation:** mask calibration fails if the land and water sample points do not separate cleanly.
- **Licence:** NASA public domain (NASA media usage guidelines)
- **Accuracy / caveats:** Shown relief is exaggerated; never read heights from it.
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)
