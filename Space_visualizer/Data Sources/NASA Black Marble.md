---
title: NASA Black Marble
publisher: NASA Earth Observatory / Visible Earth
url: https://visibleearth.nasa.gov/images/144898
used-for: [Earth night lights map]
tags: [data-source]
---

# NASA Black Marble

Back to [[Home]]

- **Publisher:** NASA Earth Observatory / Visible Earth
- **URL:** https://visibleearth.nasa.gov/images/144898
- **Source id:** `nasa-black-marble-2016`
- **File used:** `BlackMarble_2016_3km.jpg` (3 km, 2016 composite)
- **Feeds:** Earth `night` layer, shown on the unlit side of the globe.
- **Derivation:** resized to each tier, WebP quality 90.
- **Scope ruling:** the 2016 composite is used as one fixed snapshot of city lights.
- **Validation:** same 2:1 equirectangular tier-size checks as every colour layer (`readRgb8` fails on a size mismatch). The Earth day-map orientation check guards the shared geometry convention.
- **Licence:** NASA public domain (NASA media usage guidelines)
- **Accuracy / caveats:** Night lights are a 2016 snapshot and do not follow the real-time date in the app.
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)