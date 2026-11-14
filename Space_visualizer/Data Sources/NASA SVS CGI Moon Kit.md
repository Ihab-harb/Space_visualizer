---
title: NASA SVS CGI Moon Kit
publisher: NASA Scientific Visualization Studio (LROC and LOLA data)
url: https://svs.gsfc.nasa.gov/4720
used-for: [Moon colour map, Moon normal map]
tags: [data-source]
---

# NASA SVS CGI Moon Kit

Back to [[Home]]

- **Publisher:** NASA Scientific Visualization Studio. The credit shown in the app is "NASA's Scientific Visualization Studio".
- **URL:** https://svs.gsfc.nasa.gov/4720
- **Source id:** `nasa-svs-cgi-moon-kit`
- **Files used:**
  - Colour: `lroc_color_16bit_srgb_8k.tif` (8192 x 4096, 16-bit sRGB TIFF, 243,289,792 bytes). Derived from the LROC wide-angle camera mosaic. The page says: "These image is optimized for aesthetics, not science." (typo kept as on the page). The app repeats this in the drawer.
  - Elevation: `ldem_16_uint.tif` (5760 x 2880, unsigned 16-bit uncompressed strip TIFF, 33,201,026 bytes). From LOLA. The page: "unsigned 16-bit TIFFs in half-meters, relative to a radius of 1727400 meters". So elevation against the 1,737.4 km sphere is `value x 0.5 - 10000` m.
- **Feeds:** Moon `color` layer (1k and 2k committed, 4k and 8k local) and `normal` layer (1k and 2k committed, 4k local).
- **Derivation (from `LAYER_JOBS`):** the normal map comes from the elevation, relief exaggerated x2 (radius 1,737,400 m, 0.5 m per unit, strength 2). The exaggeration is illustrative.
- **Validations (1k):** maria box luminance 137.6 against far-side highlands 203.4 (ratio 0.68, limit 0.8), so the map is not flipped. Elevation range -8,480 to +9,954 m, with the minimum at 211.1 E, 61.3 S, inside the South Pole-Aitken basin. A wrong orientation or range fails the build.
- **Accuracy / caveats:** appearance only. sharp rescales unsigned 16-bit greys to 8 bits, so the DEM is read by the repo's own strip reader (`readBandFloat` with `unsigned16`). The server is slow (about 0.3 MB/s): the built-in fetch can drop the connection, so download with a resumable `curl -C -` into `pipeline/raw/textures/` if it does.
- **Licence:** NASA media usage guidelines (public domain imagery, credit requested).
- **Cache:** about 265 MB in `pipeline/raw/textures/` (git-ignored). Committed Moon textures total 17.5 MB.
- **How it is refreshed:** `npm run textures` (add `--offline` to rebuild from the cache), then `npm run data`.
- **Built by:** `pipeline/textures/build.ts` and `pipeline/textures/manifest.ts`
