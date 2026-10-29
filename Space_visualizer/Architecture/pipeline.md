---
title: pipeline
tags: [architecture]
---

# pipeline (`pipeline/`)

Back to [[Home]] · [[Overview]]

**Commands**
- `npm run data`: fetches every source, builds, validates, then writes `public/data/`.
- `npm run data:offline`: the same, using only the cached copies in `pipeline/raw/` (git-ignored).
- `npm run horizons:reference`: refreshes `pipeline/reference/horizons-heliocentric.json` (81 Horizons vectors: 72 barycentre samples and 9 Earth-centre samples).
- `npm run moon:ephemeris`: fetches the Moon's Horizons vectors and fits the Chebyshev table (about 20 minutes the first time; `--offline` reuses the cache). See "The Moon (M2b.2)" below.

**Flow:** fetch (with cache fallback) → parse (one parser per source) → build (`buildSolarSystem`) → validate (schemas, sources resolve, no duplicates) → write. If validation or fetching fails, `public/data` is left untouched and the error names the exact field.

**Measured accuracy:** the build compares each orbit table against the Horizons reference and stores `horizonsCheck` (sample count, maximum angular and distance error), which the facts & sources drawer shows. See [[0004-measured-accuracy]].

**Sources:** [[JPL Approximate Positions of the Planets]] · [[JPL Horizons]] · [[NSSDCA Planetary Fact Sheet]] · [[NSSDCA Sun Fact Sheet]] · [[NAIF PCK00011]] · [[NASA Science pages]] · [[IERS leap seconds]] · [[NASA Delta T polynomials]]

## Textures

See [[0006-webp-tiers-ktx2-deferred]] and the M2 spec [[2026-10-04-m2-cinematic-and-rich-bodies-design]].

**Commands**
- `npm run textures`: downloads the source products into `pipeline/raw/textures/` (git-ignored, about 5 GB; a download interrupted part-way restarts from zero, because it is written to a temp file and renamed on completion) and builds the committed 1k/2k tiers in `public/textures/`. Reports "Imagery for 9 bodies from 14 sources".
- `npm run textures -- --offline`: rebuilds from the cache only.
- `npm run textures:hd`: also builds 4k and 8k locally (Node runs with an 8 GB heap).
- `npm run textures:verify`: checks that every source URL still responds.

**Modules (`pipeline/textures/`):** `manifest.ts` (the product list; every product is a `Source`), `fetchBinary.ts` (cached download), `rasters.ts` (read and resample; includes a signed 16-bit strip-TIFF reader behind `readBandFloat`, because sharp/libvips clamps signed int16 GeoTIFFs to 0, which broke the Mars elevation. It throws on BigTIFF, compressed, tiled or truncated files), `derive.ts` (normal maps, masks), `rings.ts` (ring radial profiles, 2048x2), `stars.ts` (sky), `build.ts` (tiers, budget) and `run.ts`.

**Tiers and budget:** 1k to 8k, always 2:1 equirectangular. Committed textures total about 14.1 MB against a 60 MB budget the validator enforces.

**Validations:** Earth Sahara versus Pacific brightness, Mars and Mercury DEM elevation ranges, Olympus Mons peak, sky orientation. A failed validation stops the build.

**Output:** `public/textures/imagery.json` (written by `build.ts`) is merged into `public/data` by `pipeline/run.ts` and attaches `imagery` to each body; `npm run data:offline` still writes 9 bodies and 27 sources.

**Sources:** [[USGS Venus Magellan C3-MDIR Mosaic]] · [[NASA Blue Marble Next Generation]] · [[NASA Black Marble]] · [[NASA Blue Marble Clouds]] · [[NASA GEBCO Topography and Bathymetry]] · [[USGS Mars Viking Color Mosaic]] · [[USGS Mars MOLA DEM]] · [[USGS Mercury MESSENGER Mosaics]] · [[Hubble OPAL Global Maps]] · [[NASA SVS Deep Star Maps 2020]] · [[NSSDCA Ring Fact Sheets]]

## Venus radar (M2a.3)
The Venus `radar` layer comes from [[USGS Venus Magellan C3-MDIR Mosaic]] (`usgs-venus-magellan-c3`, 176 MB GeoTIFF, 18775 x 9388 px, 2025 m/pixel, 8-bit greyscale). It is a `LAYER_JOBS` entry in `build.ts` (resized with Lanczos to the 1k/2k tiers committed; 4k with `--hd`; maxTier 4k), listed as the `venus-radar` product in `manifest.ts`. The raw download adds about 170 MB to `pipeline/raw/textures/`.

**Maxwell Montes check:** at 1k the mean over the box lon 0-7 E, lat 62-68 N must exceed 1.3 times the global mean, otherwise the build throws `venus radar orientation check failed`. Measured 198.8 against 118.6 (ratio 1.68). The box is wide, so it catches a flip or a wrong longitude origin but may not catch a small longitude mirror.

Unmapped Magellan areas are black in the source and stay black. The map is radar backscatter, not visible light, and the app says so (drawer Imagery section; toggle or `?radar=1`). The radar view hides the illustrative cloud deck and the atmosphere shell.

## Body details (M2b.1)
Built in [[2026-10-10-m2b1-body-details]] from spec [[2026-10-10-m2b1-body-details-design]]. `npm run data` also writes one cited details file per body: `public/data/solar-system/details/<id>.json` for the Sun and the eight planets (9 files, about 190 KB together), plus their new sources in `public/data/sources.json`. The shape is `BodyDetails` in `src/core/details/schema.ts` (see [[core]]).

**Flow (`pipeline/run.ts` then `pipeline/build/buildDetails.ts`):**
1. **Fetch** (with the same cache fallback as every source): the eight NSSDCA per-planet fact sheets and the Sun sheet, three Gazetteer zips (`pipeline/raw/gazetteer-<TARGET>.zip`, Mercury, Venus and Mars, about 12 MB together) and every curated page (`pipeline/raw/ref-<sourceId>.html`).
2. **Parse the sheets** (`pipeline/sources/nssdcPlanetSheet.ts`): atmosphere composition (major gases in percent, minor in ppm, notes), the dipole magnetosphere block, the Sun's photosphere composition and field note, and the volumetric mean radius. Superscripts become Unicode (10⁶), subscripts stay ASCII (CO2). A reworded strength or radius line throws; other reworded dipole lines become null (a known gap).
3. **Gazetteer** (`pipeline/lib/zip.ts`, `pipeline/lib/dbf.ts`, `pipeline/sources/gazetteer.ts`): reads the zip and `.dbf` in the repo (Node `zlib`, no dependency), keeps approved features, takes the 200 with the largest diameter, rounds coordinates to 1e-4 degrees and diameters to 1e-3 km, and records the total approved count and the cut-off diameter. Only Mercury, Venus and Mars have features; the other bodies have `features: null`.
4. **Curated references** (`pipeline/reference/interiors.json`, `missions.json`, described in `pipeline/reference/README.md`): checked by `pipeline/sources/quotedReference.ts`. A source must be on an official host (nasa.gov, usgs.gov, esa.int, jaxa.jp, isro.gov.in, cnsa.gov.cn, subdomains included). Each value has a quote of at least 6 words that must appear on the fetched page; km, percent and day-level dates must appear in the quote (a number after a "(km)" table label counts as km; each interior bound may carry its own `from`). Quotes are dropped from the output. Interiors cover the Sun, Mercury, Earth and Mars only (the other five are `null`: no official numeric source); missions.json holds 43 mission entries (39 distinct missions) and a discovery entry for every body except Earth and the Sun. Mission dates keep the source page's own time-zone convention.
5. **Build** (`buildDetails`): the radius R used for interior conversion and checks is the NSSDCA sheet's mean radius (the Sun keeps `facts.meanRadiusKm`). Depth becomes R minus depth, percent becomes R times p over 100. Each converted bound keeps `from` (the form its source used) and, for depth and percent, `stated` (the source's own numbers), which is what the drawer prints; the stored radii are for the M2b.3 cutaway. A layer may carry `stateSource` (a quoted sentence), written as `stateSourceId`. A curated source whose URL is already registered (in the catalogue or as a fact sheet) is aliased to the registered id, so each page is listed once; missions are sorted by launch date, then name. The Gazetteer source record links the web page (`https://planetarynames.wr.usgs.gov/Page/<TARGET>/target`); the zip is only fetched. A body with no parsed field falls back to the facts table's "no global field". Only sources a details file references are added; an id collision with an existing source fails the build.
6. **Validate** (`validateDetails`, `checkDetails` from core) and write. Any error leaves `public/data` untouched.

**Checks (`src/core/details/checks.ts`):** interior layers run outside in with no gaps or overlaps (the boundary tolerance is max(40 km, 0.5 % of R)); major gases sum to at most 100.5 % and minor gases stay below 10⁶ ppm; at most 200 features, none above the approved total, with latitude in [-90, 90], longitude in [0, 360) and diameter above 0; mission dates are real and in order; dipole strength above 0, tilt in [0, 180] and offset in [0, 1]; every `sourceId` resolves.

**Offline:** `npm run data:offline` rebuilds the details from the cache with no network.

**Sources:** [[NSSDCA Planet Fact Sheets]] · [[NSSDCA Sun Fact Sheet]] · [[USGS Gazetteer of Planetary Nomenclature]] · [[NASA mission and science pages (curated)]]

## The Moon (M2b.2)
Built in [[2026-10-29-m2b2-moon]]. Decision: [[0008-moon-chebyshev-table]].

**Ephemeris script (`pipeline/scripts/fetchMoonEphemeris.ts`, `npm run moon:ephemeris`).** It fetches Horizons geocentric Moon vectors (command 301, centre 500@399, ecliptic J2000, TDB) in 1,826-day chunks at 180-minute steps through `fetchCached` (`pipeline/raw/horizons-moon-<startJd>.txt`, git-ignored). The even samples are fitted (`pipeline/lib/chebyshevFit.ts`). The odd samples, 3 hours from any fitted one, are held out and measure the error. It tries four settings and keeps the smallest under 1 km: 16-day segments, degree 12 (5,730 segments, 1.88 MB, max 0.904 km / 0.4792 arcsec over 366,720 held-out samples). Outputs: `public/data/solar-system/ephemeris/moon.json` and `pipeline/reference/horizons-moon-check.json` (one held-out sample per 3 days, the all-sample summary, and the Moon at the M1 reference dates). The Horizons cache name does not include the step or chunk length, so clear the cache if you change them. See [[JPL Horizons]].

**In the build.** `buildSolarSystem` adds the Moon with a satellite orbit. The table range comes from `chebyshevRange(moon.json)`, not Table 1. `mu` comes from the GM kernel ([[NAIF GM DE440]]), the mean elements are parsed from the live JPL page ([[JPL Planetary Satellite Mean Elements]]; `jplSatElem.ts` fails if the epoch is not 2000-01-01.5 or the warning is gone) and the facts come from [[NSSDCA Moon Fact Sheet]]. The build recomputes the table error over the committed held-out subset and fails if it exceeds the stored summary. Earth moves off the barycentre and gains `centreCheck` (6 samples, max 2,190 km radial, 11.8 arcsec; the bound is the Table 1 nominal, under 6,000 km, because Earth still rests on the approximate barycentre). `validateOutput` checks that the table file exists, parses, has the range the orbit states, and that its source ids resolve.

**Details.** `moon` joins `DETAIL_BODY_IDS`. `parseMoonExosphere` reads the "Estimated Composition (night, particles per cubic cm)" block of the Moon sheet into `atmosphere.numberDensity` (9 gases in `cm⁻³`, all upper limits, `kind: 'exosphere'`). The note is the sheet's caveat paragraph plus its Trace and Possible lists. The interior (crust, mantle, core) and the field sentence come from curated NASA pages; `interiors.json` gained an optional quoted `magneticField`. The Moon has 12 missions (Apollo 8 moved here from Earth) and no discovery entry (no official sentence found). The Gazetteer covers `MOON` (a 24 MB zip).

**Moon imagery (`pipeline/textures/`).** [[NASA SVS CGI Moon Kit]]: `moon-color` (LROC colour, 8k) and `moon-dem` (LOLA, 5760 x 2880, unsigned 16-bit TIFF). sharp rescales unsigned 16-bit greys to 8 bits, so `readBandFloat(..., { unsigned16: true })` reuses the strip reader. Validations: maria darker than highlands (ratio 0.68, limit 0.8) and the DEM minimum inside South Pole-Aitken. The normal map uses strength 2 (illustrative). Committed Moon textures total 17.5 MB. `npm run data:offline` now writes 10 bodies, 98 sources and 10 details files.
