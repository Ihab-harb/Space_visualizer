---
title: M2b.1 Body Details Data — Design Spec
date: 2026-10-10
status: awaiting review
amends: "[[2026-10-04-m2-cinematic-and-rich-bodies-design]]"
milestone: M2b.1
tags: [spec, m2b, data]
---

# M2b.1 Body Details Data — Design Spec

Back to [[Home]] · Details §8 of [[2026-10-04-m2-cinematic-and-rich-bodies-design]] (M2b outline) · Follows [[2026-10-07-m2a3-interface-and-tour]] · Session: [[2026-10-04-session-m1-to-m2a3]]

## 1. Intent

M2 spec §8 adds four areas of body detail: interior and composition, atmosphere, missions and discovery, and features and fields. Every value in them must be cited. M2b is too large for one section, so it is split. The user chose "data first" on 2026-10-10:

| Section | Scope |
|---|---|
| **M2b.1** (this spec) | The cited data for all four areas, built by the offline pipeline and shown in the facts & sources drawer |
| M2b.2 | The Moon (orbit, imagery from the CGI Moon Kit, shading, details) |
| M2b.3 | Animated interior cutaway and composition charts |
| M2b.4 | Clickable feature pins on the globe, magnetic field lines with particles, aurora ovals |
| M2b.5 | Per-body chapters in the bottom bar that play themselves |

**Success criteria for M2b.1:**
- The Sun and all eight planets have a details file. Each file contains every area that applies to that body, and every value in it carries a citation.
- The build fails on any value that is out of range, inconsistent or unsupported by its source (§5).
- Startup cost is unchanged: a body's details load only when that body is first selected.
- The M1 to M2a.3 accuracy and "every value cited" rules still hold, and all existing tests still pass.

## 2. Decisions taken in brainstorming (2026-10-10)

| Topic | Decision |
|---|---|
| M2b order | Data first: M2b.1 data, then the Moon, the cutaway and charts, pins and fields, and chapters |
| Interior layers | **Curated and quoted.** Each layer value records its source URL and the exact sentence it came from, and the build fails if that sentence is no longer on the page. Uncertain values (such as giant-planet cores) are stored as ranges and flagged as uncertain |
| Missions | **Key missions, curated and quoted** (about 5 to 12 per body): the first flyby, first orbiter, first lander or probe, and current missions, each with launch date, arrival date, type and outcome. Discovery is recorded for Uranus and Neptune; the rest are known since antiquity |
| Named features | **Size-filtered** from the USGS Gazetteer: approved features only, the largest (about 200) per body |
| Data layout | **Option B: one details file per body, loaded on demand.** The user may revisit this later |

## 3. Data model

`src/core/details/schema.ts` holds a Zod schema shared by the pipeline and the app. One file per body: `public/data/solar-system/details/<bodyId>.json`.

```ts
BodyDetails = {
  schemaVersion: 1,
  bodyId: string,
  generatedAt: ISO datetime,
  interior: { layers: InteriorLayer[] } | null,
  atmosphere: Atmosphere | null,        // null only when no source gives composition; Mercury's exosphere is recorded with a note
  magnetosphere: Magnetosphere,
  missions: Mission[],                  // date order
  discovery: Discovery,
  features: Features | null,            // null: the Gazetteer has no entries for this body (Earth, the Sun, the giants)
}

InteriorLayer = {
  id: string, name: string,                         // e.g. 'outer-core', "Outer core"
  outerRadiusKm: SourcedRange, innerRadiusKm: SourcedRange,  // innermost layer has inner radius 0
  state: 'solid' | 'liquid' | 'gas' | 'plasma' | 'unknown',
  composition: { text: string, sourceId } | null,
  uncertain: boolean,
}
SourcedRange = { min: number, max: number, sourceId }   // min === max for a single value

Atmosphere = {
  major: Gas[], minor: Gas[],                       // major as % by volume, minor as ppm
  surfacePressureBar: SourcedValue | null,
  meanTemperatureK: SourcedValue | null,
  note: { text, sourceId } | null,                  // e.g. Mercury's exosphere, the giants' "no solid surface; values at 1 bar"
}
Gas = { name: string, formula: string, amount: number, unit: '%' | 'ppm', uncertainty: number | null, sourceId }

Magnetosphere =
  | { kind: 'none', note: { text, sourceId } }     // Venus, Mars
  | { kind: 'dipole', strengthGaussR3: SourcedValue, tiltDeg: SourcedValue, tiltLongitudeDeg: SourcedValue | null,
      offsetRadii: SourcedValue | null, referenceRadiusKm: SourcedValue, surfaceFieldGauss: SourcedRange | null }
  | { kind: 'other', note: { text, sourceId } }    // the Sun: a dynamic field, described in cited text, not a dipole

Mission = {
  id: string, name: string, agency: string,
  type: 'flyby' | 'orbiter' | 'lander' | 'rover' | 'probe' | 'sample-return' | 'impactor' | 'observatory',
  launchDate: ISO date, arrivalDate: ISO date | null, endDate: ISO date | null,
  outcome: 'success' | 'partial' | 'failure' | 'ongoing' | 'planned',
  sourceId,
}

Discovery = { kind: 'antiquity', sourceId } | { kind: 'discovered', by: string, date: ISO date, method: string, sourceId }

Features = {
  totalApproved: SourcedValue, thresholdKm: number, sourceId,
  items: Array<{ name: string, type: string, latDeg: number, lonDegE: number, diameterKm: number, origin: string, approvedYear: number | null }>,
}
```

Every `sourceId` resolves to a `Source` in the shared `public/data/solar-system/sources.json`.

## 4. Pipeline (offline, `npm run data:offline`)

| Area | Source | Method |
|---|---|---|
| Atmosphere, magnetic field | NSSDCA per-planet fact sheets: `https://nssdc.gsfc.nasa.gov/planetary/factsheet/<planet>fact.html` (the Sun uses `sunfact.html`, already in use) | A new parser, `pipeline/sources/nssdcPlanetFactSheet.ts`. It reads the "Atmospheric composition" block (major %, minor ppm, uncertainties in parentheses), surface pressure, mean temperature and the magnetosphere block (dipole field strength, tilt, tilt longitude, offset, reference radius, surface field). Fetched through `fetchCached`. Tests run against stored copies of the real pages in `pipeline/fixtures/` |
| Named features | USGS Gazetteer of Planetary Nomenclature, nightly per-body shapefiles: `https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/<TARGET>_nomenclature_center_pts.zip` (MERCURY, VENUS and MARS now; MOON in M2b.2) | A small built-in reader for the `.dbf` table inside the zip, with no new dependency. It keeps approved features (status "adopted"), drops dropped and never-approved ones, sorts by diameter and keeps the top 200, recording the cut-off diameter as `thresholdKm`. Coordinates are planetocentric latitude and east longitude, per the Gazetteer. The real column names are checked against the downloaded file when the plan is written |
| Interior layers | NASA Science planet pages, the NSSDCA fact sheets (core radius, with footnotes), and NASA or USGS mission science pages | A curated file, `pipeline/reference/interiors.json`. Each value has `{ value or min/max, url, quote }`, and the build checks the quote (below) |
| Key missions, discovery | NASA mission pages, the NSSDCA Master Catalog spacecraft pages, and NASA Science discovery text | A curated file, `pipeline/reference/missions.json`, in the same shape and with the same quote check |

**The quote check.** `pipeline/sources/quotedReference.ts` fetches each cited page through the cache and normalises whitespace and HTML entities. It fails the build with the file, the entry and the URL if the recorded quote is not on the page, or if the recorded number does not appear inside the quote. A cached copy keeps offline builds reproducible, and `npm run data` refreshes the cache. The agents that write the plan's tasks gather the curated values, and the quote check enforces them.

**Outputs:** `public/data/solar-system/details/<id>.json` for the Sun and the eight planets. New `Source` entries are added to `sources.json`, and `Space_visualizer/Data Sources/` gains a note per new source family.

## 5. Build checks (the build fails)

- Interior layers are ordered from the outside in, without gaps or overlaps beyond the stated ranges. Every radius lies between 0 and the body's mean radius. The innermost layer's inner radius is 0.
- Gas amounts are non-negative. Major gases sum to no more than 100 %, within a 0.5 % tolerance. ppm values are under 10⁶.
- Feature latitudes lie in [−90, 90], longitudes in [0, 360) east, and diameters are greater than 0. The item count is no more than 200 and no more than `totalApproved`.
- Dates are valid ISO dates. Arrival is never before launch, and end is never before arrival.
- Dipole tilt lies in [0, 180], strength is greater than 0, and the offset lies in [0, 1].
- Every `sourceId` resolves to a source, and every curated quote passes the quote check.
- Each file passes `BodyDetailsSchema`.

## 6. Runtime

- **Loading:** `src/state/detailsStore.ts` (Zustand) tracks the status of each body: `idle | loading | ready | missing | error`. The first selection of a body starts `fetch(details/<id>.json)` and validates the result with the schema. The store caches results, so repeat selections reuse them. A failure never affects the scene, the header facts or the existing drawer sections. Only the new sections show "Details unavailable", with a Retry button.
- **Drawer** (`FactsDrawer`): new sections below the current facts, each with a heading anchor (`#details-interior` and so on), and every value cited.
  - **Interior:** layers from the outside in, with radius or depth (a range where sources disagree), state, and an "uncertain" tag.
  - **Atmosphere:** major gases (%), minor gases (ppm), surface pressure, mean temperature and the note.
  - **Magnetic field:** a dipole table (strength, tilt, offset), or the cited "no global field" or "other" text.
  - **Key missions:** in date order, with launch and arrival dates and type and outcome tags.
  - **Discovery:** one line.
  - **Named features:** the 10 largest, then "Showing 10 of N approved features (≥ X km)".
  - **While loading:** a quiet "Loading details…" line, with no layout jump into the existing sections.
- **Citations:** `citationModel` adds the details sources *after* the body's existing sources and the live source. Header numbers therefore never shift when the details arrive, and the header and drawer stay in sync.
- **Header narrative:** once details are ready, `buildNarrative` may use one sentence built from them, for example "Its atmosphere is 95.1% carbon dioxide; it has no global magnetic field." It stays at three sentences or fewer, with every value cited. The known moon wording bug is fixed here too: a body with a non-star parent says "orbits <parent>", not "circles the Sun".

## 7. Testing

- **Unit:**
  - the details schema (valid and rejected examples);
  - the NSSDCA parser against stored copies of at least Mars, Jupiter, Earth and Venus;
  - the `.dbf` reader and the feature filter;
  - the quote check (pass, missing quote, number not in quote);
  - every build check in §5;
  - `detailsStore` states (loading, ready, missing, error, retry);
  - the drawer sections for a rocky planet, a giant, the Sun and a body with no field;
  - citation order (details sources append after the existing ones);
  - the narrative sentence and the moon wording.
- **End-to-end:**
  - Mars shows Interior, Atmosphere, Magnetic field ("no global field"), Key missions and Named features, with citations;
  - a header citation still opens the drawer at the same source;
  - a blocked details request shows "Details unavailable" and the rest of the drawer still works;
  - the startup request list does not include any details file.
- **Pipeline:** `data:offline` runs from the cache with no network, and the output passes the schema and every check.

## 8. Out of scope for M2b.1

- Charts, the cutaway, globe pins and field lines (M2b.3 and M2b.4).
- The Moon (M2b.2).
- Earth surface features: the Gazetteer has no Earth entries, and another official source would be needed.
- Chapters (M2b.5).
- Full mission lists.
- Features below the size cut.
