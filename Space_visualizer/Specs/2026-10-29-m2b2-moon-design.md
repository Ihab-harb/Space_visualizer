---
title: M2b.2 The Moon — Design Spec
date: 2026-10-29
status: draft (written from the vault's existing plan at the user's request; no brainstorming round)
amends: "[[2026-10-04-m2-cinematic-and-rich-bodies-design]]"
milestone: M2b.2
tags: [spec, m2b, moon]
---

# M2b.2 The Moon — Design Spec

Back to [[Home]] · Outline: M2 spec §8 ([[2026-10-04-m2-cinematic-and-rich-bodies-design]]) and the M2b split in [[2026-10-10-m2b1-body-details-design]] §1 · Follows [[2026-10-10-m2b1-body-details]] · Session: [[2026-10-29-session-m2b2-moon]]

## 1. Intent

The M2 spec says M2b "adds the Moon (Earth's chapters need it), using the CGI Moon Kit imagery". The M2b.1 spec splits M2b and gives this section its scope: "The Moon (orbit, imagery from the CGI Moon Kit, shading, details)".

On 2026-10-29 the user asked to skip the design questions and use the vault's existing plan. So every choice below comes from one of three places:
- **the vault** (M1 spec §5 position models, M2 spec §2 and §6, the M2b.1 spec, the carry-over note);
- **official source facts** checked on 2026-10-29 (§9);
- **my call**, marked *(my call)*, and listed again in §10 so the user can check them.

The project goals hold: accuracy, information and visuals carry equal weight; every value is cited to an official source; illustrative visuals are labelled.

**Success criteria**
- The Moon is a selectable body (`id: 'moon'`, category `moon`, parent `earth`) with its position, rotation, shape, facts, description, imagery, details and measured accuracy.
- From 1800 to 2050 the Moon's position matches JPL Horizons to within **1 km** (geocentric). The facts drawer shows the measured figure.
- Earth is drawn at its own centre, not at the Earth–Moon barycentre.
- Real eclipses show on their dates: the Moon's shadow on Earth on 2024-04-08 and Earth's shadow on the Moon on 2025-03-14.
- The Moon in Realistic mode reads as the real Moon: LRO colour, LOLA relief, an even full-phase brightness (no limb darkening) and a crisp terminator.
- No regression in the M1 accuracy tests, the "every value cited" rule or the existing unit and end-to-end tests.

## 2. Decisions

| Topic | Decision | Where it comes from |
|---|---|---|
| Position, 1800–2050 | Pre-fetched **JPL Horizons** geocentric vectors, compressed to Chebyshev polynomials in the pipeline (the method JPL's own ephemerides use) | M1 spec §5: "`table` … optionally high-accuracy bodies (e.g. the Moon …) — Pre-fetched Horizons state vectors, interpolated"; compression is *(my call)* |
| Position, other dates | **JPL SSD Planetary Satellite Mean Elements** for the Moon, with node and apsis precession | M1 spec §5 `satellite-mean`; old M2 row "`satellite-mean`, `table` for the Moon" |
| Earth's position | Earth = barycentre − the Moon's share of the Earth–Moon vector, using the NAIF DE440 GM values | Needed once the Moon exists; the drawer note "the Moon arrives in a later release" is retired *(my call on the GM source)* |
| Rotation and shape | NAIF PCK00011, body 301 (the existing parser already reads `BODY3_NUT_PREC_ANGLES`) | [[NAIF PCK00011]] |
| Facts | NSSDCA Planetary Fact Sheet, `MOON` column, plus the NSSDCA Moon Fact Sheet | Same parser as the planets |
| Imagery | NASA SVS **CGI Moon Kit** (LROC colour, LOLA elevation → normal map) | M2 spec §6 table |
| Shading | The `rocky` shader with strong Lommel–Seeliger blend | M2 spec §11 (Moon reference: "CGI Moon Kit, LOLA normals, Lommel–Seeliger reflectance") |
| Details | All five M2b.1 areas, curated and quoted the same way | M2b.1 spec §2 |
| Narrative distance | Distances to a non-star parent show in km, not AU | Carry-over: "the Moon … would read '0.00 AU'" |
| Apollo 8 | Listed under the Moon's missions | Carry-over: "belongs with the Moon in M2b.2" |

## 3. Position model

### 3.1 Moon, 1800–2050: Horizons Chebyshev table
- **Pipeline input:** Horizons vectors for COMMAND `301`, CENTER `500@399` (Earth's centre), ecliptic J2000 (`REF_PLANE 'ECLIPTIC'`, `REF_SYSTEM 'ICRF'`), TDB, km. Fetched in date chunks (Horizons limits the rows per request) and cached in `pipeline/raw/` like every other source.
- **Fit:** fixed-length segments; one Chebyshev series per axis per segment, least-squares fitted to the samples in that segment. The plan picks the segment length, degree and sample step. **Targets:** maximum fit error ≤ 1 km on held-out samples (times between the fitting samples), and the committed file ≤ 2 MB (raised from 1.5 MB while planning: a 1 km fit needs about 200k coefficients). If both cannot be met, accuracy wins and the size is recorded. *(My call: the fit is a lossless-enough compression of an official product; it is cited as JPL Horizons and its error is measured and shown, the same way the M1 approximate tables are.)*
- **Output:** a separate data file, `public/data/solar-system/ephemeris/moon.json` (schema in `src/core`), loaded by `loadCatalog` alongside `bodies.json`. Coefficients are rounded so they add no more than 0.01 km error.
- **Accuracy record:** the build stores `horizonsCheck` for this table: the number of held-out samples, the maximum distance error in km and the maximum angular error as seen from Earth's centre, in arcseconds.

### 3.2 Moon, other dates: JPL mean elements
- From https://ssd.jpl.nasa.gov/sats/elem/ (Moon row): a = 384400 km, e = 0.0554, ω = 318.15°, M = 135.27°, i = 5.16°, node = 125.08°, P = 27.322 d, P(apsis) = 5.997 yr, P(node) = 18.600 yr, epoch 2000-01-01.5 TDB, ecliptic frame, "centered on the planet". The page itself warns these are "not intended for ephemeris computation". The app says so in the drawer next to the measured error.
- The node regresses and the apsis advances linearly with their stated periods *(my call: that is what the two period columns describe)*.
- **Validity:** inside 3000 BC–AD 3000 this is the fallback, so the bottom-bar status reads "extended" (amber), like a planet on its fallback table. Outside it reads "out of range".
- **Accuracy record:** measured against Horizons at the M1 reference dates outside 1800–2050 (and a few inside, for comparison). Expect errors of a few degrees; the number is shown, whatever it is.

### 3.3 Earth and the barycentre
- The JPL approximate elements give the Earth–Moon barycentre (EMB). With `r` the Moon's geocentric vector and `μ = GM_Moon / (GM_Earth + GM_Moon)`:
  - Earth = EMB − μ·r
  - Moon = Earth + r
- GM values come from NAIF `gm_de440.tpc` (`BODY399_GM`, `BODY301_GM`), cited as a new source. μ ≈ 0.01215, so Earth sits about 4,670 km from the barycentre.
- When the Moon uses the fallback model, Earth uses the same `r`, so the pair always stays consistent.
- **Accuracy record for Earth:** add Horizons samples for body `399` to the reference file and measure the composed Earth position against them. The drawer shows that figure; the barycentre table's existing figure stays in its own line.
- **Orbit line:** Earth's orbit line stays the barycentre's path, which is the true orbit. The drawer says so. *(My call: shifting the line to pass through Earth would draw a path no body follows.)*

### 3.4 Code shape
- `src/core/ephemeris/`: a Chebyshev evaluator, a mean-elements evaluator and a **system state** function that computes all bodies for one date, parents before children, so a moon's heliocentric position is its parent's plus its own offset and the barycentre correction is applied once. `bodyState` stays for bodies with no children or satellites.
- `src/scene/frameState.ts` `updateBodies` calls the system function. Validity status includes the Moon.
- The orbit schema gains a variant for a body that orbits its parent (the plan names it), holding: the parent id, the Chebyshev table reference and its `horizonsCheck`, the mean elements with their source, and the barycentre mass ratio with its source.

## 4. Facts and details

### 4.1 Facts (bodies.json)
- From the **Moon Fact Sheet** (more digits than the Planetary Fact Sheet): mass, mean radius, density, gravity, escape velocity, sidereal rotation period, obliquity, and the orbit about Earth: semi-major axis, perigee, apogee, revolution period, **synodic period** (29.53 days), mean orbital velocity, inclination to the ecliptic, eccentricity.
- From the Planetary Fact Sheet `MOON` column: diameter, length of day, mean temperature, surface pressure, moons, rings, global magnetic field. Its starred orbit cells ("for the orbit about the Earth") are not read for the Moon, so they never become "distance from the Sun".
- New fact keys for an orbit about a parent: mean distance from the parent, periapsis, apoapsis (km), and the synodic period. Orbital period, velocity, inclination and eccentricity keep their keys, with a note "About Earth".
- Description: the meta description of https://science.nasa.gov/moon/, like the planets.
- Rotation note: the Moon is tidally locked. The drawer states the sidereal rotation period and orbital period side by side; no "tidally locked" claim is printed unless a quoted NASA sentence backs it.

### 4.2 Details (`details/moon.json`)
- **Interior:** curated and quoted from NASA pages, in the M2b.1 style (each bound with its exact sentence, the build re-checks the page). If no official page gives numbers, the section is `null`, as for the giant planets.
- **Atmosphere (exosphere):** the Moon Fact Sheet gives an "Estimated Composition (night, particles per cubic cm)" with the note that values are upper limits and the composition is "poorly known and variable". The details schema gains a third gas unit, **particles per cm³**, for exospheres. The drawer heads the section "Exosphere" and prints the sheet's caveat. No conversion to percent *(my call: the sheet's values are upper limits, so percentages would invent precision)*.
- **Magnetic field:** `kind: 'other'` with a quoted NASA sentence about the Moon's lack of a global field and its crustal magnetism, or `kind: 'none'` cited to the Planetary Fact Sheet's "Global Magnetic Field? No" if no better sentence is found.
- **Missions:** about 10 to 14 key missions, each quoted from an official agency page: firsts (impact, far-side image, soft landing, orbit, crewed orbit, crewed landing, sample return, far-side landing) and current ones. Apollo 8 with the quote already researched. Other agencies' pages (CNSA, ISRO, JAXA) are allowed by the existing host list.
- **Discovery:** known since antiquity.
- **Named features:** the USGS Gazetteer `MOON` zip, top 200 approved features by diameter, with the total and the cut-off.

## 5. Imagery and shading

### 5.1 Products (NASA SVS 4720, CGI Moon Kit, checked 2026-10-29)
- **Colour:** `lroc_color_16bit_srgb_8k.tif` (2025 version, 8192×4096, 16-bit sRGB TIFF, 232.0 MB) for 1k–8k tiers *(my call: the 2025 colour version over the 2019 one, since SVS lists it as the newer map; the screenshot loop confirms it looks right)*.
- **Elevation:** `ldem_16_uint.tif` (5760×2880, unsigned 16-bit, "half-meters, relative to a radius of 1727400 meters", 31.7 MB) → normal map up to 4k (above 4k would exceed the source resolution). The relief factor is recorded in `derivation`.
- **Credit:** "NASA's Scientific Visualization Studio". The page also says the colour map "is optimized for aesthetics, not science"; the drawer's Imagery section repeats that.
- The raw products are not committed; the 1k and 2k tiers are, inside the 60 MB budget.

### 5.2 Validation (build fails otherwise)
- **Colour orientation:** the near-side maria are dark and the far-side highlands bright: the mean brightness of Oceanus Procellarum / Mare Imbrium (a box the plan defines from Gazetteer centres) is well below that of a far-side highland box.
- **Elevation:** the decoded range is plausible (lowest point below −8 km, highest above +8 km relative to 1737.4 km), and the lowest region falls inside the South Pole–Aitken basin (Gazetteer centre and diameter).

### 5.3 Shading (Realistic mode)
- `rocky` shader, colour and relief, Lommel–Seeliger blend near 1 so the full Moon is evenly bright. The exact value is tuned in the screenshot loop.
- **Earthshine** *(my call; illustrative)*: the Moon's night side gets a faint blue-grey light scaled by how much of Earth's day side faces the Moon. The strength is illustrative and labelled so.
- **Lunar eclipse colour** *(my call; illustrative)*: inside Earth's umbra the Moon is not black but a dim copper red (sunlight refracted through Earth's atmosphere). The eclipse geometry is real; the tint is illustrative and labelled.
- **Solar eclipse:** the existing analytic eclipse code already takes the nearest bodies as occluders, so the Moon's shadow on Earth needs no new geometry. The plan checks that the Moon is picked as Earth's occluder and Earth as the Moon's.

## 6. Scene, camera and interface

- **Readable scale:** positions are never changed. A moon is drawn only when its on-screen distance from its parent exceeds the parent's drawn radius plus its own plus a few pixels; otherwise it is hidden (no fade: the body shaders are opaque, and a fade would need a new uniform in every material *(my call)*). Its label and orbit line follow the same rule. The rule applies in true scale too, where both bodies are below a pixel when it triggers *(ruling during Task 6)*. Moons use a 3 px minimum radius instead of 5 *(my call)*.
- **Moon orbit line:** the Moon's real geocentric path over one sidereal month centred on the current date, sampled from the same ephemeris and placed around Earth's current position. It fades with the Moon.
- **Pill label datum:** for a moon, the distance from its parent in km (for example "MOON · 384,402 km").
- **Header:** subtitle "Moon of Earth · <distance>"; chips: From Earth (km), light time (s), **Phase** (illuminated fraction and name, such as "78% · waxing gibbous", computed from the cited positions), length of day. Narrative: "orbits Earth every 27.3 days at an average of 384,400 km" with each number cited.
- **Drawer:** facts with the new keys; position accuracy (Horizons table figure, fallback figure and the mean-elements warning); details sections (Exosphere heading for the Moon); Imagery with the SVS credit and the "aesthetics, not science" note.
- **Tour:** the Moon is a stop right after Earth (6 radii away, dwell on the lit side) *(my call)*.
- **URL:** `target=moon` works like any body.

## 7. Testing and visual QA

- **Unit tests (core):** Chebyshev evaluation against known polynomials; segment lookup at boundaries; mean elements at the epoch reproduce the stated values; node and apsis rates; barycentre split (Earth + Moon weighted by mass returns the barycentre exactly); system state with parents first; validity status with the Moon.
- **Pipeline tests:** Horizons chunk parsing; the fit meets 1 km on a synthetic orbit and on a cached real chunk; the fact-sheet star handling; the Moon sheet exosphere parser; Gazetteer `MOON`; the new GM parser; the texture validations on synthetic rasters.
- **Accuracy test:** the committed Moon table against committed Horizons check samples (max 1 km), and the composed Earth against Horizons `399` samples.
- **End-to-end:** selecting the Moon updates the header and the drawer; `target=moon` loads; the details file loads; no page errors; textures ready.
- **Golden views** (look checklist, reviewed by eye; no pixel diffs):
  1. Moon close-up at first quarter: terminator crisp, relief visible along it, maria where they belong.
  2. Full Moon: evenly bright disc, no limb darkening.
  3. Earth and Moon together, from about 1 million km.
  4. 2024-04-08 18:17 UTC: the Moon's shadow on North America.
  5. 2025-03-14 06:58 UTC: the Moon inside Earth's shadow, copper tint.
  6. Overview: the Moon hidden; no label clutter near Earth.

## 8. Out of scope
- Other moons (M3).
- Feature pins on the Moon (M2b.4), the interior cutaway (M2b.3), chapters (M2b.5).
- Libration as a separate display (the IAU rotation model already includes the physical librations the PCK describes).
- Terrain displacement (M2 spec §12).
- Lunar positions outside the Horizons table more accurate than the mean elements.

## 9. Source facts checked on 2026-10-29
- **CGI Moon Kit** (https://svs.gsfc.nasa.gov/4720): file list as in §5.1; "floating-point TIFFs in kilometers, relative to a radius of 1737.4 km"; "unsigned 16-bit TIFFs in half-meters, relative to a radius of 1727400 meters"; "These image is optimized for aesthetics, not science."; credit "NASA's Scientific Visualization Studio".
- **JPL satellite mean elements** (https://ssd.jpl.nasa.gov/sats/elem/): the Moon row in §3.2; "Warning! These mean orbital parameters are not intended for ephemeris computation."
- **NSSDCA Moon Fact Sheet** (https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html): bulk and orbital parameters, synodic period 29.53 days, the night exosphere composition in particles per cm³ with its caveats; no magnetic field statement.
- **NSSDCA Planetary Fact Sheet**: has a `MOON` column; its orbit cells are starred (0.384*, 0.363*, 0.406*, 27.3*, 1.0*).
- **NAIF PCK00011**: `BODY301_POLE_RA`, `_POLE_DEC`, `_PM`, `_NUT_PREC_RA/DEC/PM` and `BODY301_RADII = (1737.4 1737.4 1737.4)`; the angles are `BODY3_NUT_PREC_ANGLES`.

## 10. My calls, for the user to check
1. Chebyshev compression of Horizons vectors (≤ 1 km, ≤ 2 MB, separate file).
2. NAIF `gm_de440.tpc` for the Earth–Moon mass ratio.
3. Earth's orbit line stays the barycentre path.
4. Exosphere kept in particles per cm³, not converted to percent.
5. 2025 colour map version.
6. Earthshine and lunar-eclipse tint, both labelled illustrative.
7. Moons drawn at a 3 px minimum and hidden when they would overlap their parent.
8. The Moon is a Tour stop after Earth.
9. Mean elements: linear node and apsis motion from the stated periods.
