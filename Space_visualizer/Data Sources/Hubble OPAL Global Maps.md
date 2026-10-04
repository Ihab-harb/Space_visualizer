---
title: Hubble OPAL Global Maps
publisher: NASA/ESA Hubble Space Telescope via STScI MAST (OPAL program, PI A. Simon)
url: https://doi.org/10.17909/T9G593
used-for: [Jupiter, Saturn, Uranus and Neptune colour maps]
tags: [data-source]
---

# Hubble OPAL Global Maps

Back to [[Home]]

- **Publisher:** NASA/ESA Hubble Space Telescope via STScI MAST (OPAL program, PI A. Simon)
- **URL:** https://doi.org/10.17909/T9G593
- **Source id:** `stsci-opal`
- **Files used (HLSP cycle 31 `globalmap.tif`):** Jupiter 2024c (F395N/F502N/F631N), Saturn 2024a (F395N/F502N/F631N), Uranus 2023a (F467M/F547M/F657N), Neptune 2025a (F467M/F547M/F657N)
- **Feeds:** the `color` layer of each giant planet (tiers 1k/2k committed; 4k local).
- **Derivation (from `LAYER_JOBS`):** Hubble OPAL global map (filter composite); longitude alignment approximate. Written as WebP quality 90.
- **Scope ruling:** the latest OPAL year available for each planet is used (one epoch per planet, no time series). Atmospheric features move, so the map does not match the simulated date.
- **Validation:** No per-product validation. The source is resized to the tier size with `fit: 'fill'` (`readRgb8`/`readBandFloat`), so it assumes a 2:1 equirectangular input; a wrong-aspect source would be silently stretched. This layer has no per-product orientation guard; it relies on the same equirectangular convention as the other layers (`lonOffsetDeg` 0 in the manifest). Longitude alignment to the app's prime meridian is approximate and is stated as such in the layer derivation text.
- **Licence:** Public HLSP data; acknowledge NASA/ESA HST OPAL program (PI: Simon, GO13937), archived by STScI.
- **Accuracy / caveats:** Band flow shown in the app is illustrative.
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache in `pipeline/raw/textures/`; `npm run textures -- --hd` also builds the git-ignored 4k/8k tiers), then `npm run data` to merge `public/textures/imagery.json` into `public/data`.
- **Built by:** `pipeline/textures/build.ts` (jobs in `LAYER_JOBS`, products in `pipeline/textures/manifest.ts`)
