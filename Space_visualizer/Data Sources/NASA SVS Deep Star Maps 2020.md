---
title: NASA SVS Deep Star Maps 2020
publisher: NASA Goddard Scientific Visualization Studio
url: https://svs.gsfc.nasa.gov/4851
used-for: [Sky background]
tags: [data-source]
---

# NASA SVS Deep Star Maps 2020

Back to [[Home]]

- **Publisher:** NASA Goddard Scientific Visualization Studio
- **URL:** https://svs.gsfc.nasa.gov/4851
- **Source id:** `nasa-svs-deep-star-maps`
- **Files used:** `starmap_2020_4k.exr` (about 36 MB) and `starmap_2020_8k.exr` (about 130 MB, local HD only)
- **Feeds:** the sky background (`imagery.bodies.sky.color`), stored only in `public/textures/imagery.json` and not in `bodies.json`, since the sky is not a body. Tiers 2k and 4k are committed; 8k is local.
- **Derivation:** EXR decoded (linear), converted to sRGB 8-bit, written as WebP quality 92; 2k is a Lanczos downscale of the 4k map.
- **Validation:** an orientation check looks for known bright stars/landmarks and the build fails unless at least 4 match.
- **Licence:** NASA public domain (credit NASA/Goddard SVS; Gaia DR2: ESA/Gaia/DPAC)
- **Accuracy / caveats:** Background only; star positions are not used for any fact.
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)
