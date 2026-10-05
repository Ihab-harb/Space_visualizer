---
title: USGS Mercury MESSENGER Mosaics
publisher: USGS Astrogeology Science Center (NASA MESSENGER data)
url: https://planetarymaps.usgs.gov/mosaic/
used-for: [Mercury colour and normal maps]
tags: [data-source]
---

# USGS Mercury MESSENGER Mosaics

Back to [[Home]]

- **Publisher:** USGS Astrogeology Science Center (NASA MESSENGER data)
- **URL:** https://planetarymaps.usgs.gov/mosaic/
- **Source ids:** `usgs-mercury-md3-color` (MDIS Basemap MD3 Color Mosaic, 665 m) and `usgs-mercury-dem` (USGS DEM, 665 m)
- **Files used:** `Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif` and `Mercury_Messenger_USGS_DEM_Global_665m_v2.tif`
- **Feeds:** Mercury `color` and `normal` layers (tiers 1k/2k committed; color 8k and normal 4k local).
- **Derivation (from `LAYER_JOBS`):**
  - color: MDIS 3-colour mosaic desaturated 80% toward Mercury's natural grey-brown.
  - normal: Normal map derived from the MESSENGER DEM; relief exaggerated x3 (radius 2439.4 km, strength 3), lossless WebP.
- **Validation:** DEM elevation must lie within -3000 m below to 3000 m above of the reference radius (`assertElevationRange`).
- **Licence:** USGS public domain (U.S. Government work)
- **Accuracy / caveats:** The MD3 mosaic is enhanced colour, so the desaturation is a stated artistic step and the final colour is illustrative.
- **Cache:** about 800 MB and 530 MB downloads go to `pipeline/raw/textures/` (git-ignored).
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)
