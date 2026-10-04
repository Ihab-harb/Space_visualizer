---
title: NASA Blue Marble Next Generation
publisher: NASA Earth Observatory / Visible Earth (R. Stöckli)
url: https://visibleearth.nasa.gov/images/74092
used-for: [Earth day colour map]
tags: [data-source]
---

# NASA Blue Marble Next Generation

Back to [[Home]]

- **Publisher:** NASA Earth Observatory / Visible Earth (R. Stöckli)
- **URL:** https://visibleearth.nasa.gov/images/74092
- **Source id:** `nasa-blue-marble-ng`
- **File used:** `world.200407.3x21600x10800.jpg` (21600x10800 JPEG)
- **Feeds:** Earth `color` layer (tiers 1k/2k committed; 4k/8k local).
- **Derivation:** resized to each tier and written as WebP quality 90. No colour grading.
- **Scope ruling:** a single month (July 2004) is used. It is a composite of that month, not a live view, so seasonal snow and vegetation do not change in the app.
- **Validation:** at 1k the build requires the Sahara (13E, 23N) to be more than 40 luminance units brighter than the Pacific (160W, 0N); this fails if the map is flipped or shifted.
- **Licence:** NASA public domain (NASA media usage guidelines)
- **Accuracy / caveats:** Imagery is for appearance only. No fact or position is derived from it.
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)