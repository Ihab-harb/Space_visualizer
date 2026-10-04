---
title: USGS Mars MOLA DEM
publisher: USGS Astrogeology Science Center (NASA MGS MOLA team data)
url: https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif
used-for: [Mars normal map]
tags: [data-source]
---

# USGS Mars MOLA DEM

Back to [[Home]]

- **Publisher:** USGS Astrogeology Science Center (NASA MGS MOLA team data)
- **URL:** https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif
- **Source id:** `usgs-mars-mola-dem`
- **File used:** `Mars_MGS_MOLA_DEM_mosaic_global_463m.tif` (about 2.1 GB, 463 m/pixel, metres)
- **Feeds:** Mars `normal` layer (tiers 1k/2k committed, 4k local).
- **Derivation (from `LAYER_JOBS`):** Normal map derived from MOLA elevation; relief exaggerated x3 (radius 3389.5 km, 1 m per unit, strength 3). Lossless WebP. The exaggeration is illustrative.
- **Validation:** elevation must span -5000 m below to 15000 m above (`assertElevationRange`), and the highest point must lie within 5 degrees of Olympus Mons (133.8W, 18.65N) or the build fails and names `lonOffsetDeg`.
- **Licence:** USGS public domain (U.S. Government work)
- **Accuracy / caveats:** Appearance only; heights are not shown as facts.
- **Cache:** largest single download (about 2.1 GB) goes to `pipeline/raw/textures/` (git-ignored).
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)