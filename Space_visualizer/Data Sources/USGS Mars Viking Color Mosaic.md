---
title: USGS Mars Viking Color Mosaic
publisher: USGS Astrogeology Science Center
url: https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m
used-for: [Mars colour map]
tags: [data-source]
---

# USGS Mars Viking Color Mosaic

Back to [[Home]]

- **Publisher:** USGS Astrogeology Science Center
- **URL:** https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m
- **Source id:** `usgs-mars-viking-color`
- **File used:** `Mars_Viking_ClrMosaic_global_925m.tif` (about 800 MB, 925 m/pixel)
- **Feeds:** Mars `color` layer (tiers 1k/2k committed; 4k/8k local).
- **Derivation:** resized to each tier, WebP quality 90.
- **Validation:** tier size check on read. Orientation is guarded indirectly by the MOLA DEM check (Olympus Mons position), because both products share the USGS -180..180 longitude convention.
- **Licence:** USGS public domain (U.S. Government work)
- **Accuracy / caveats:** The Viking colour mosaic is processed colour and not a true-colour photograph.
- **Cache:** the download goes to `pipeline/raw/textures/` (git-ignored).
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)