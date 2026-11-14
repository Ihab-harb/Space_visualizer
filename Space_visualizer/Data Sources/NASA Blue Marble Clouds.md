---
title: NASA Blue Marble Clouds
publisher: NASA Earth Observatory / Visible Earth
url: https://visibleearth.nasa.gov/images/57747
used-for: [Earth cloud layer]
tags: [data-source]
---

# NASA Blue Marble Clouds

Back to [[Home]]

- **Publisher:** NASA Earth Observatory / Visible Earth
- **URL:** https://visibleearth.nasa.gov/images/57747
- **Source id:** `nasa-blue-marble-clouds`
- **File used:** `cloud_combined_8192.tif` (8192x4096 greyscale)
- **Feeds:** Earth `clouds` layer (single-channel WebP).
- **Derivation (from `LAYER_JOBS`):** Static cloud composite; its slow drift in the app is illustrative.
- **Scope ruling:** one static composite, not live weather. Drift speed is a visual effect and is labelled illustrative in the UI.
- **Validation:** No per-product validation. The source is resized to the tier size with `fit: 'fill'` (`readRgb8`/`readBandFloat`), so it assumes a 2:1 equirectangular input; a wrong-aspect source would be silently stretched. 8k is the native width, so 8k is the highest tier built.
- **Licence:** NASA public domain (NASA media usage guidelines)
- **Accuracy / caveats:** Not the real weather for the simulated date.
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)
