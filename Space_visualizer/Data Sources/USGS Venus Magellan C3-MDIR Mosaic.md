---
title: USGS Venus Magellan C3-MDIR Mosaic
publisher: USGS Astrogeology Science Center (NASA Magellan data)
url: https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_mosaic_2025m
used-for: [Venus radar view]
tags: [data-source]
---

# USGS Venus Magellan C3-MDIR Mosaic

Back to [[Home]]

- **Publisher:** USGS Astrogeology Science Center (NASA Magellan data)
- **URL:** https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_mosaic_2025m
- **Source id:** `usgs-venus-magellan-c3`
- **File used:** `Venus_Magellan_C3-MDIR_Global_Mosaic_2025m.tif` (176,335,453 bytes, 18775 x 9388 px, 2025 m/pixel, 8-bit greyscale, simple cylindrical, -180 to 180 E)
- **Feeds:** Venus `radar` layer (tiers 1k/2k committed; 4k local with `--hd`).
- **Derivation:** resized to each tier (Lanczos), WebP quality 90. No colour or relief is added.
- **Validation:** at 1k the mean over the Maxwell Montes box (lon 0-7 E, lat 62-68 N) must exceed 1.3 x the global mean, otherwise the build throws `venus radar orientation check failed`. Measured 198.8 against a global mean of 118.6 (ratio 1.68).
- **What it shows:** Magellan radar backscatter, NOT visible light. Brightness is radar roughness and slope, so highlands such as Maxwell Montes (Ishtar Terra) and Aphrodite Terra are bright. Black areas are places Magellan did not map (the south polar cap, orbit gaps and thin stripes); they are shown as black, not filled.
- **Use in the app:** a toggle in the facts drawer (or `?radar=1`) swaps the Venus cloud deck for this map and hides the atmosphere shell.
- **Licence:** USGS public domain (U.S. Government work)
- **Cache:** the download goes to `pipeline/raw/textures/` (git-ignored).
- **How it is refreshed:** `npm run textures`, then `npm run data:offline`.
- **Built by:** `pipeline/textures/build.ts` (job in `LAYER_JOBS`, product in `pipeline/textures/manifest.ts`)
