---
title: M2b.4a Feature pins — Implementation Plan
date: 2026-11-15
status: complete (whole-branch review, fix wave and scoped re-review done 2026-11-15)
milestone: M2b.4a
spec: "[[2026-11-15-m2b4a-feature-pins-design]]"
tags: [plan, m2b, features, explore]
---

# M2b.4a Feature pins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Back to [[Home]] · Spec: [[2026-11-15-m2b4a-feature-pins-design]] · Session: [[2026-11-15-session-m2b4-pins]]

**Goal:** in Explore, a Surface tab shows named landmark pins on the globe, each with a cited card, backed by a searchable list of every feature in the data; the interior views move under an Interior tab.

**Architecture:** the pipeline gains a curated `landmarks.json` (quote-checked like missions) and writes `landmarks` and `featureTypes` into each body's details file. `exploreStore` gains the tab, the selected feature and the list state. Pins are DOM labels in the existing label layer, placed each frame by a projector in the Canvas that reuses `labelLayout`; a pure `surfacePoint` function maps latitude and longitude to the body-fixed frame the textures use, and a guard test proves it against the committed maps. The camera gains a sunlit entry direction and an orbit turn to a feature.

**Tech Stack:** TypeScript, React 19, React Three Fiber / three.js 0.186, Zustand, Zod 4, Vitest 5, Playwright (SwiftShader), tsx pipeline, sharp (guard test only).

**Spec:** `Space_visualizer/Specs/2026-11-15-m2b4a-feature-pins-design.md`. Executors read it first; §11 lists the calls. `pipeline/reference/README.md` holds the curated-quote rules.

## Global Constraints
- Official sources only. Quoted sentences: hosts in `OFFICIAL_HOSTS` (nasa.gov, usgs.gov, esa.int, jaxa.jp, isro.gov.in, cnsa.gov.cn). **No research papers for landmark sentences.** The NGA host is allowed **for position sources only**.
- **No position is ever read off a map or a picture, and none is typed from memory.** Every stored position is the Gazetteer's, a names-database record's, or a number stated in a quoted sentence.
- Every value shown carries its `[n]` from the shared `citationModel`. Details sources only ever **append** to the citation order, so existing numbers never change.
- `src/core` stays pure (zod only). Hotkeys stay in `src/ui/hotkeys.ts` (the single owner).
- Keys in Explore: **1** Surface, **2** Exploded, **3** Half-section. **Esc** steps back one level: chart, layer card, feature card, feature list, then Explore.
- URL: `view=surface|exploded|section`; `view=whole` is an alias of `surface`; `feature=<id>`.
- Reduced motion: fades and the camera turn become cuts.
- Layout tests at 390x844, 800x1000, 1024x768, 1100x800, 1280x720 stay green. Phone width is ≤ 720 px (`NARROW_QUERY`).
- Pins are interface, not surface: white dots and text, cyan (`--interaction` token) for the selected pin; names in capitals in the interior labels' style.
- Plain, short sentences in user-facing text.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage only the task's files; never `git add -A`. Never run two Playwright runs at once; stop only processes you started. `npm run data` needs the network; `npm run data:offline` must pass after every data task.
- Rulings made while building go into this note's "Execution record" before any scratch file is deleted.

## Review Focus
1. **A feature on the far side, or at a pole** (picked from the list or the URL): the camera turns the short way round without passing through the body, no NaN at latitude ±90, and the pin shows only once it faces the camera (Task 2 `surfacePoint` pole test; Task 7 turn tests).
2. **Search input the data does not expect** (accents, capitals, leading spaces, an empty box, no match): "Tycho" is found by "tycho" and "  TYCHO"; "Bronte" finds "Brontë"; no match shows "No features match" and never an empty panel (Task 10 tests).
3. **Changing tab or leaving while a card, the list or a camera turn is open**: the card and list close, pins hide while the body is open, the turn stops, and Esc still leaves in order (Task 6 store tests; Task 7 cancel test).
4. **Details missing, failed or still loading on Surface**: the tabs still work, no pins and no button show, nothing throws; a body with no features shows its note (Task 8 tests).
5. **A drag during a camera turn, and a resize or a turned phone with the card and list open**: the user's drag wins at once; names, card, list, tabs and strip never overlap (Task 7 cancel test; Task 9 layout test at two viewport sizes; Task 11 layout e2e).

---

## File map
| File | Responsibility |
|---|---|
| `pipeline/sources/gazetteer.ts` | one row per approved feature; ids; pull a feature by name |
| `src/core/details/featureId.ts` (new) | `featureId(name)`, `foldText(s)` |
| `src/core/details/schema.ts`, `checks.ts` | `FeatureItem.id`, `Landmark`, `featureTypes`, their checks |
| `src/core/frames/surfacePoint.ts` (new) | latitude and longitude to the body-fixed direction and point |
| `pipeline/textures/placement.test.ts` (new) | the placement guards on the committed maps |
| `pipeline/reference/landmarks.json` (new) | curated landmarks, type meanings, position sources |
| `pipeline/sources/landmarks.ts` (new) | file types, `verifyLandmarks`, `parseStatedPosition` |
| `pipeline/sources/namesDatabase.ts` (new) | GNIS and GNS record fetch and parse (Earth positions) |
| `pipeline/build/buildDetails.ts`, `pipeline/run.ts` | wire landmarks into the details files |
| `src/state/exploreStore.ts`, `urlParams.ts`, `src/ui/hotkeys.ts` | tab, feature selection, list, URL, keys |
| `src/camera/explore.ts`, `CameraSystem.tsx` | sunlit entry, turn to a feature |
| `src/state/viewStore.ts` | `useRadarShown()` (Venus radar on Surface) |
| `src/ui/explore/ExploreOverlay.tsx`, `explore.css` | tabs, sub-switch, notes, mounts card and list |
| `src/ui/explore/featureModel.ts` (new) | merged feature entries, order, search, position text |
| `src/scene/surface/pinAnchors.ts`, `FeaturePins.tsx` (new) | pin projection, facing rule, DOM pins and names |
| `src/ui/explore/FeatureCard.tsx`, `FeatureList.tsx` (new) | the card and the All features panel |
| `src/ui/citations.ts` | landmark sources appended to the order |

---

### Task 1: One row per feature, and feature ids

**Files:**
- Create: `src/core/details/featureId.ts`, `src/core/details/featureId.test.ts`
- Modify: `pipeline/sources/gazetteer.ts`, `pipeline/sources/gazetteer.test.ts`, `src/core/details/schema.ts` (`FeatureItemSchema`), `src/core/details/checks.ts`, `src/core/details/checks.test.ts`, `src/test/detailsFixtures.ts`
- Regenerate: `public/data/solar-system/details/*.json`, `public/data/sources.json`

**Background (measured 2026-11-15 on `pipeline/raw/gazetteer-MERCURY.zip`):** the Mercury `.dbf` has 614 approved rows but 606 distinct names; 8 names appear twice, 7 of them in today's top 200 (Discovery Rupes, Mirni Rupes, Kunisada, Michelangelo, Matisse, Milton, Lange). The pairs differ only slightly (Kunisada: diameter 241.45 against 241, longitude 113.0217 against 112.8589). Mars has 1 duplicated name in 2,052 rows, outside the top 200. Each row has a `link` column (the feature's Gazetteer page).

**Interfaces:**
- Produces: `featureId(name: string): string` and `foldText(s: string): string` in `featureId.ts`; `FeatureItem.id: string`; `dedupeRows(rows): Array<Record<string,string>>` and `findFeature(rows, name): FeatureItem | null` exported from `gazetteer.ts`; `selectFeatures` unchanged in signature.

- [x] **Step 1: Find the cause and write the ruling.** For each duplicated Mercury pair and the Mars pair, print both rows' `link`, `approvaldt`, `diameter`. Decide per pair: same `link` means one feature listed twice; different `link` means two features that share a name. For same-feature pairs, fetch the feature's Gazetteer page (`link`) and keep the row whose diameter and centre match the page. Record the pairs, the links and the kept rows in this note's Execution record. If the page cannot be fetched, keep the row with more decimal places in `diameter` and say so in the record.

- [x] **Step 2: Write the failing tests**

```ts
// featureId.test.ts
expect(foldText('  Brontë ')).toBe('bronte');
expect(featureId('Olympus Mons')).toBe('olympus-mons');
expect(featureId("Chang'e Planitia")).toBe('chang-e-planitia');
expect(featureId('Von Kármán M')).toBe('von-karman-m');
// gazetteer.test.ts
it('keeps one row per feature and refills to the limit', () => { /* rows with a same-link pair -> selectFeatures(rows, 's', 3) has 3 items, 3 distinct ids, totalApproved counts the pair once */ });
it('gives two features that share a name distinct ids', () => { /* different links, same name -> ids 'x' and 'x-<type folded>' */ });
it('finds a feature below the size cut by exact name', () => { expect(findFeature(rows, 'Tycho')?.diameterKm).toBeCloseTo(85.294, 3); expect(findFeature(rows, 'tycho')).toBeNull(); });
// checks.test.ts
it('rejects two features with the same id', () => { expect(checkDetails(dupIds, ctx)).toContainEqual(expect.stringContaining('duplicate feature id')); });
```

- [x] **Step 3: Run them.** `npx vitest run src/core/details pipeline/sources/gazetteer.test.ts` → the new tests FAIL.

- [x] **Step 4: Implement.** `foldText`: NFD, strip combining marks, lower case, trim. `featureId`: `foldText`, runs of non-alphanumerics to `-`, trim `-`. `dedupeRows`: one row per `link` (the kept row per Step 1's ruling, encoded as a rule, not a name list, where the ruling allows). `selectFeatures` runs `dedupeRows` first, counts `totalApproved` after it, and sets `id`; a second feature with the same id gets `-<folded type>`. `findFeature`: exact, case-sensitive match on the clean name among approved, deduped rows. `checkDetails`: duplicate feature id is an error.

- [x] **Step 5: Rebuild and verify.** `npm run data:offline` → "Wrote 10 bodies…". Then `node -e "const f=require('./public/data/solar-system/details/mercury.json').features;console.log(f.items.length,new Set(f.items.map(i=>i.id)).size,f.totalApproved.value)"` → `200 200 606` (or the count Step 1's ruling gives; record it). `npm test` and `npm run typecheck` → pass.

- [x] **Step 6: Commit** the task's files and the regenerated data: `fix(data): one Gazetteer row per feature, with stable feature ids`.

---

### Task 2: Surface point maths and the placement guards

**Files:**
- Create: `src/core/frames/surfacePoint.ts`, `src/core/frames/surfacePoint.test.ts`, `pipeline/textures/placement.test.ts`

**Background:** body meshes are a unit `SphereGeometry` rotated `rotateX(Math.PI / 2)` and scaled `(Re, Re, Rp)` (`src/scene/BodyMesh.tsx`); `uvForLonLat(lonDeg, latDeg)` in `src/scene/materials/bodyUniforms.ts` gives `u = lon/360 + 0.5`, `v = 0.5 + lat/180`. So image longitude 0 is at the map's centre column and the object-space direction of (lat, lon east) is `(cos lat · cos lon, cos lat · sin lon, sin lat)`. Whether **each committed map** really has longitude 0 at its centre and east to the right is what the guards prove.

**Interfaces:**
- Produces: `surfaceDirection(latDeg: number, lonDegE: number): Vec3` (unit, body-fixed); `surfacePoint(latDeg: number, lonDegE: number, flattening: number): Vec3` (body radii; `flattening` = polar over equatorial radius; `[cos lat · cos lon, cos lat · sin lon, flattening · sin lat]`).

- [x] **Step 1: Write the failing unit tests**

```ts
expect(surfaceDirection(0, 0)).toBeCloseToVec([1, 0, 0]);
expect(surfaceDirection(0, 90)).toBeCloseToVec([0, 1, 0]);
expect(surfaceDirection(90, 123)).toBeCloseToVec([0, 0, 1]);   // pole: no NaN, longitude ignored
expect(surfaceDirection(-90, 0)).toBeCloseToVec([0, 0, -1]);
expect(surfacePoint(90, 0, 0.9)).toBeCloseToVec([0, 0, 0.9]);
it('agrees with the mesh: every vertex of the rotated SphereGeometry sits at surfaceDirection of its uv', () => {
  // build new SphereGeometry(1, 16, 8).rotateX(Math.PI / 2); for each vertex away from the poles:
  // lon = (uv.x - 0.5) * 360, lat = (uv.y - 0.5) * 180; expect position ≈ surfaceDirection(lat, lon) within 1e-6
});
```
(Use the repo's existing vector comparison helper if there is one; otherwise compare component-wise.)

- [x] **Step 2: Run** `npx vitest run src/core/frames/surfacePoint.test.ts` → FAIL (module missing). **Step 3: Implement.** **Step 4: Run** → PASS.

- [x] **Step 5: Write the placement guard** `pipeline/textures/placement.test.ts`. It reads the committed 1k maps with `sharp` (`public/textures/<body>/color_1k.webp`; Venus: `public/textures/venus/radar_1k.webp`) and feature positions from the committed details files (`features.items`, then `landmarks` once Task 4 adds them), by name. For a feature at (lat, lon) it compares the mean luminance of a disc of angular radius `r` at `uvForLonLat(lon, lat)` with the ring from `r` to `2r` around it.

```ts
const GUARDS = {
  moon:    [{ name: 'Mare Moscoviense', expect: 'darker' }, { name: 'Mare Crisium', expect: 'darker' }],
  mars:    [{ name: 'Syrtis Major Planum', expect: 'darker' }, { name: 'Hellas Planitia', expect: 'brighter' }],
  mercury: [/* two chosen in this step */],
  venus:   [{ name: 'Ovda Regio', expect: 'brighter' }, { name: 'Maxwell Montes', expect: 'brighter' }],
};
for each body: it('pins land on the picture', …)           // every guard passes at its true position
for each body: it('a mirrored longitude would be caught', …) // at lon -> 360 - lon, at least one guard fails
for each body: it('a half-turn shift would be caught', …)    // at lon -> lon + 180, at least one guard fails
```
The names above are starting points, not facts to trust: confirm each against the map by running the test, and replace any that does not discriminate (Mercury's map is low in contrast; a bright rayed crater such as Kuiper or a dark smooth plain are candidates). A feature below the size cut becomes available after Task 4; until then use features in `features.items` and tighten later. Record the final features, `r` and the measured contrast per guard in the Execution record. Earth's guard is added in Task 5.

- [x] **Step 6: Run** `npx vitest run pipeline/textures/placement.test.ts` → PASS for all four bodies. **If a body fails at the true position**, the map's longitude origin or direction differs from `uvForLonLat`: stop, report it (it is a rendering bug older than this section), and fix it only with a ruling in the Execution record.

- [x] **Step 7: Commit** `test(textures): surface point maths and placement guards on the committed maps`.

---

### Task 3: Landmarks in the pipeline and the schema

**Files:**
- Create: `pipeline/sources/landmarks.ts`, `pipeline/sources/landmarks.test.ts`, `pipeline/reference/landmarks.json`
- Modify: `src/core/details/schema.ts`, `src/core/details/checks.ts` (+ tests), `pipeline/build/buildDetails.ts` (+ test), `pipeline/run.ts`, `pipeline/reference/README.md`, `src/test/detailsFixtures.ts`, `src/ui/citations.ts` (+ test)

**Interfaces:**
- Produces (schema, `src/core/details/schema.ts`):

```ts
LandmarkSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1), type: z.string().min(1),
  latDeg: z.number(), lonDegE: z.number(),            // lonDegE in [0, 360)
  diameterKm: z.number().positive().nullable(),
  origin: z.string().nullable(), approvedYear: z.number().int().nullable(),
  position: z.object({ kind: z.enum(['gazetteer', 'names-database', 'quoted']), sourceId: SourceId, text: z.string().nullable() }), // text: the position as the source wrote it (quoted and names-database), null for the Gazetteer
  sizeSourceId: SourceId.nullable(),
  quote: z.object({ text: z.string().min(1), sourceId: SourceId }),
});
BodyDetailsSchema += landmarks: z.array(LandmarkSchema),                       // rank order; [] when none
                     featureTypes: z.record(z.string(), z.object({ meaning: z.string().min(1), sourceId: SourceId })), // by Gazetteer type; {} when none
```
- Produces (curated file, `pipeline/sources/landmarks.ts`):

```ts
interface LandmarksFile {
  sources: CuratedSource[];                                   // quote pages, OFFICIAL_HOSTS
  types: Record<string, { meaning: string; sourceId: string; quote: string }>;
  bodies: Record<string, CuratedLandmark[]>;                  // rank order
}
type CuratedLandmark =
  | { name: string; sourceId: string; quote: string }        // Gazetteer body: everything else comes from the Gazetteer by name
  | { name: string; type: string; sourceId: string; quote: string; position: EarthPosition; size?: { km: number; sourceId: string; quote: string } };
type EarthPosition =
  | { kind: 'names-database'; database: 'gnis' | 'gns'; recordId: string }
  | { kind: 'quoted'; latDeg: number; lonDegE: number; sourceId: string; quote: string };
verifyLandmarks(file: LandmarksFile, pages: Map<string, string>): string[]   // same message style as verifyMissions
parseStatedPosition(quote: string): { latDeg: number; lonDegE: number; text: string } | null
```
- Consumes: `findFeature`, `featureId` (Task 1); `quoteOnPage`, `pageText`, `OFFICIAL_HOSTS`, `MIN_QUOTE_WORDS`, `quoteHasKm` (`quotedReference.ts`).
- `DetailsInputs` gains `landmarks: LandmarksFile` and `earthPositions: ReadonlyMap<string, { latDeg: number; lonDegE: number; text: string; sourceId: string; retrievedAt: string }>` (keyed by `recordId`; empty until Task 5).

- [x] **Step 1: Write the failing tests**

```ts
// landmarks.test.ts — parseStatedPosition
expect(parseStatedPosition('The summit lies at 27.99° N, 86.93° E in the range')).toMatchObject({ latDeg: 27.99, lonDegE: 86.93 });
expect(parseStatedPosition('located at 36°06′ N, 112°06′ W')).toMatchObject({ latDeg: 36.1, lonDegE: 247.9 });   // minutes to decimal; west to 360 - x
expect(parseStatedPosition('at latitude -25.3 and longitude 131.0')).toMatchObject({ latDeg: -25.3, lonDegE: 131 });
expect(parseStatedPosition('about 28 degrees north')).toBeNull();            // one number is not a position
expect(parseStatedPosition('27.99° N, 86.93°')).toBeNull();                  // no hemisphere or sign on the longitude
// verifyLandmarks
it('passes a landmark whose quote is on its page', …)                         // []
it('fails a quote that is not on the page / is under 6 words / is on a non-official host / cites an unregistered source', …)
it('fails a paper source', …)                                                 // kind: 'paper' -> "papers are not allowed for landmarks"
it('fails an Earth landmark whose quoted position numbers are not in its quote', …)
it('fails an Earth size whose km is not in its quote', …)                     // quoteHasKm
it('fails a duplicate landmark name within a body', …)
// buildDetails.test.ts
it('fills a Gazetteer landmark from the Gazetteer by name, in file order', …) // Tycho below the cut: latDeg, lonDegE, diameterKm, type, origin, approvedYear from findFeature; position.kind 'gazetteer'
it('errors when a landmark name is not an approved Gazetteer feature', …)     // "details/moon.json: landmark Tychoo is not an approved Gazetteer feature"
it('writes featureTypes only for types the body uses', …)
it('writes landmarks: [] and featureTypes: {} for a body with none', …)
// checks.test.ts
it('rejects duplicate landmark ids, out-of-range positions, and a Gazetteer landmark whose values differ from its features row', …)
// citations.test.ts
it('appends landmark sources after every existing details source', …)         // numbers of a fixture without landmarks are unchanged when landmarks are added
```

- [x] **Step 2: Run** `npx vitest run pipeline/sources/landmarks.test.ts pipeline/build src/core/details src/ui/citations.test.ts` → the new tests FAIL.

- [x] **Step 3: Implement.**
  - `parseStatedPosition`: two numbers, each with a hemisphere letter (N/S, E/W), the words north/south/east/west, or the words latitude/longitude with a sign; degrees with optional minutes (`°`, `′` or `'`); output decimal degrees rounded to 4 places, `lonDegE` in [0, 360); `text` is the matched span as written.
  - `verifyLandmarks`: registered and official-host sources, no `kind: 'paper'`, quote on page and ≥ `MIN_QUOTE_WORDS`, type-meaning quotes on their page and containing both the type and the meaning, quoted positions equal to `parseStatedPosition(quote)`, sizes pass `quoteHasKm`.
  - `buildDetails`: verify the file; per body build `landmarks` in file order with `id = featureId(name)`; Gazetteer bodies via `findFeature` on the body's rows (error if missing); Earth via `earthPositions` or the quoted position; `featureTypes` for the types that the body's `features.items` and `landmarks` use and the file defines; add landmark sources through the existing curated-source aliasing.
  - `run.ts`: read `landmarks.json`, fetch each source page into the cache as `ref-<sourceId>.html` (the existing loop), pass `landmarks` and an empty `earthPositions`.
  - `detailsSourceOrder` (`src/ui/citations.ts`): after the features sources, append, in order, each landmark's `quote.sourceId`, `position.sourceId`, `sizeSourceId`, then each `featureTypes` source.
  - `landmarks.json` starts with **two** Mars landmarks (Olympus Mons, Valles Marineris) and one type meaning, each with a real quote found on an official page and already in the cache, to prove the path end to end.
  - README: a "Landmarks" section with the file shape, the two-things rule (a sentence worth showing, an official position), the position rule and the no-papers rule.

- [x] **Step 4: Run** the tests → PASS. `npm run data` (network, for the new pages), then `npm run data:offline` → both write 10 details files. `npm test`, `npm run typecheck` → pass.

- [x] **Step 5: Commit** `feat(data): curated landmarks with quote checks, type meanings, and the details schema for them`.

---

### Task 4: Landmarks for Mercury, Venus, the Moon and Mars

**Files:**
- Modify: `pipeline/reference/landmarks.json`, `pipeline/textures/placement.test.ts`
- Regenerate: `public/data/solar-system/details/{mercury,venus,moon,mars}.json`, `public/data/sources.json`

**Interfaces:** consumes Task 3's file format. Produces 15 to 25 landmarks per body in rank order, and the type meanings.

- [x] **Step 1: Research, with a log.** For each body, start from NASA's own overview pages for it (science.nasa.gov planet and Moon pages, NASA mission pages, USGS Astrogeology, ESA) and list the surface features they name. A feature qualifies when (a) one of those pages has a sentence about it of 6 or more words that is worth reading on a card, and (b) its exact name is an approved Gazetteer feature of that body (check with `findFeature` on the cached rows; the Gazetteer's spelling wins). Keep a log in the Execution record: page searched, features found, features rejected and why (no sentence, name not in the Gazetteer, sentence only in an image caption that is not on the fetched page).
- [x] **Step 2: Rank.** Order each body's list best known first: the features NASA's overview page for the body names first, then the rest by size. The order is editorial; say so in the log.
- [x] **Step 3: Type meanings.** From the USGS Gazetteer's descriptor-terms page (host `usgs.gov`), add a `types` entry for every Latin type that the four bodies' features and landmarks use (`node -e` over the details files lists them). A row shorter than 6 words is quoted together with a neighbouring row, as the README allows for tables. If the page cannot be fetched or quoted, leave `types` empty and record it; the card then shows the Latin type alone (spec §5.3).
- [x] **Step 4: Build.** `npm run data` → no errors. Fix every quote the check rejects by re-copying the sentence from the cached page; never edit a quote to pass.
- [x] **Step 5: Counts.** `node -e` prints the landmark count per body. Target 15 to 25. **Fewer than 8 on any body: stop and report to the user** (spec §6.2).
- [x] **Step 6: Tighten the guards.** With landmarks now in the data, replace any weak guard feature from Task 2 with a better landmark (for example a bright rayed crater), keep the mirror and half-turn tests passing, and update the Execution record. `npx vitest run pipeline/textures/placement.test.ts` → PASS.
- [x] **Step 7:** `npm run data:offline`, `npm test`, `npm run typecheck` → pass. **Commit** `feat(data): landmarks for Mercury, Venus, the Moon and Mars`.

---

### Task 5: Earth landmarks and the names databases

**Files:**
- Create: `pipeline/sources/namesDatabase.ts`, `pipeline/sources/namesDatabase.test.ts`, `Space_visualizer/Decisions/0010-names-databases-for-earth-positions.md`, `Space_visualizer/Data Sources/Earth names databases (GNIS, GNS).md`
- Modify: `pipeline/sources/landmarks.ts` (+ test), `pipeline/run.ts`, `pipeline/reference/landmarks.json`, `pipeline/reference/README.md`, `pipeline/textures/placement.test.ts`
- Regenerate: `public/data/solar-system/details/earth.json`, `public/data/sources.json`

**Interfaces:**
- Produces: `POSITION_HOSTS = [...OFFICIAL_HOSTS, 'nga.mil'] as const` (in `landmarks.ts`); `namesRecordUrl(database: 'gnis' | 'gns', recordId: string): string`; `parseNamesRecord(database, body: string): { name: string; latDeg: number; lonDegE: number; text: string } | null`; `namesSourceSpec(database): SourceSpec` (ids `usgs-gnis`, `nga-gns`).
- `run.ts` fills `earthPositions` by fetching each `names-database` landmark's record into `pipeline/raw/names-<database>-<recordId>.<ext>` through the existing cached fetch.

- [x] **Step 1: Research the two databases, and write the ruling.** Find, on the official sites only (USGS for GNIS; the NGA GEOnet Names Server), a stable way to fetch **one record by its id** that the pipeline's fetcher can use without a login, a key or a browser, and the licence text. Record in the Execution record: the URL form, the response format, the fields holding the name and the coordinates, the licence, and one fetched example each. **If a database offers no such fetch** (only a bulk download of hundreds of MB, or a form), try its bulk file only if it is under 50 MB per needed country or theme; otherwise mark that database unusable. **If neither is usable, stop and tell the user**: Earth then falls back to quoted-sentence positions alone (spec §6.2).
- [x] **Step 2: Write the failing tests** with two saved real responses as fixtures in `pipeline/fixtures/`:

```ts
expect(parseNamesRecord('gnis', gnisFixture)).toMatchObject({ name: <the fixture's name>, latDeg: <its latitude>, lonDegE: <its longitude as 0–360 east> });
expect(parseNamesRecord('gns', gnsFixture)).toMatchObject({ … });
expect(parseNamesRecord('gnis', '<html>not a record</html>')).toBeNull();
it('fails an Earth landmark whose record name differs from the landmark name', …)   // verifyLandmarks: "earth/<name>: record <id> is named <other>"
it('fails a names-database record on a host outside POSITION_HOSTS', …)
it('never accepts a POSITION_HOSTS-only host for a quoted sentence', …)              // nga.mil as a quote source -> not on an official host
```
(Expected numbers come from the fixtures themselves, read at test time or copied from the fetched record, never from memory.)
- [x] **Step 3: Run** → FAIL. **Step 4: Implement** the fetch URL, the parser and the checks; the landmark's stored name must equal the record's name, or the record must list it as a variant name (then the card shows the landmark name and the position `text` says which record name it came from).
- [x] **Step 5: Research Earth landmarks, with a log.** From NASA (Earth Observatory, SVS, science.nasa.gov), USGS and ESA pages: places with a sentence worth showing. For each, find its record in GNIS (United States) or GNS (elsewhere) and store the record id; where no record exists, use a quoted position if an official sentence states one; otherwise drop it. Each landmark has a plain `type` (for example "Mountain range", "Desert", "Reef"). Rank best known first. Log what was searched, found and dropped.
- [x] **Step 6: Build and count.** `npm run data` → no errors. Count Earth's landmarks. **Fewer than 8: stop and report to the user.**
- [x] **Step 7: Earth's placement guard.** Add Earth to `placement.test.ts` using two landmarks on land whose mirrored and half-turned longitudes fall on ocean; the measure is land against ocean on the colour map (for example blue-channel share), tuned by running the test. Record the choice.
- [x] **Step 8: Write decision note 0010** (ADR style, like `0009-peer-reviewed-papers-for-estimates.md`): the user's decision of 2026-11-15, what the NGA may be used for (positions only), what it may not (quoted sentences), how records are checked, and the fallback. Write the data-source note. Update the README.
- [x] **Step 9:** `npm run data:offline`, `npm test`, `npm run typecheck` → pass. **Commit** `feat(data): Earth landmarks with positions from GNIS and the GEOnet Names Server`.

---

### Task 6: Explore state, URL and keys

**Files:**
- Modify: `src/state/exploreStore.ts` (+ test), `src/state/urlParams.ts` (+ test), `src/ui/hotkeys.ts` (+ test)

**Interfaces:**
- Produces (in `exploreStore`): 

```ts
export type ExploreTab = 'surface' | 'interior';
export const tabOf = (view: ExploreView): ExploreTab => (view === 'whole' ? 'surface' : 'interior');
// new state
lastInteriorView: 'exploded' | 'section';   // 'exploded' on enter
selectedFeatureId: string | null;
featureSeq: number;                          // bumped by every selectFeature(id !== null): the camera turns
featureListOpen: boolean;
// new actions
setTab(tab: ExploreTab): void;               // surface -> view 'whole'; interior -> lastInteriorView
selectFeature(id: string | null): void;      // a non-null id also sets view 'whole' and closes the layer card
toggleFeatureList(open?: boolean): void;
```
`ExploreView` stays `'whole' | 'exploded' | 'section'` (the scene depends on it). `setView('exploded' | 'section')` records `lastInteriorView`, clears `selectedFeatureId` and closes the list; `setView('whole')` clears `selectedLayerId`. `enter` and `leave` reset all of it.
- URL: `urlParams.ts` accepts `view=surface` as `'whole'`; `feature=<id>` (`/^[a-z0-9-]+$/`) calls `selectFeature(id)` after `enter`, only with `explore=1` and a valid target.
- Hotkeys: actions and keys unchanged; `exploreBack` order becomes chart, layer card, feature card (`selectFeature(null)`), feature list, leave.

- [x] **Step 1: Write the failing tests**

```ts
it('opens on Surface', () => { enter('mars'); expect(tabOf(s().view)).toBe('surface'); });
it('Interior opens Exploded first, then the view used last', () => { setTab('interior'); expect(s().view).toBe('exploded'); setView('section'); setTab('surface'); setTab('interior'); expect(s().view).toBe('section'); });
it('entering again forgets the last interior view', …)
it('selecting a feature goes to Surface, closes the layer card and bumps featureSeq', …)
it('an interior view clears the feature and closes the list', …)
it('leave clears the feature, the list and the tab memory', …)
it('selecting another body leaves Explore and clears the feature', …)
// urlParams
it('view=surface and view=whole both open Surface', …)
it('feature=olympus-mons selects it; feature without explore=1 is ignored; a malformed id is ignored', …)
// hotkeys
it('Esc closes the chart, then the layer card, then the feature card, then the list, then Explore', …)
it('keys 1, 2, 3 pick Surface, Exploded, Half-section', …)
```
- [x] **Step 2: Run** `npx vitest run src/state src/ui/hotkeys.test.ts` → new tests FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npm run typecheck` → clean.
- [x] **Step 5: Commit** `feat(explore): Surface and Interior tabs, feature selection and list state, URL and keys`.

---

### Task 7: Camera — sunlit entry and the turn to a feature

**Files:**
- Modify: `src/camera/explore.ts` (+ `explore.test.ts`), `src/camera/CameraSystem.tsx`, `e2e/explore.spec.ts` (camera restore test stays green)

**Interfaces:**
- Consumes: `litAzimuth(bodyKm, sunKm)` (`src/camera/tour.ts`, Sun azimuth + 35°); `sphericalFromOffset`, `MAX_ELEVATION_RAD`, `orbit.setView({ azimuthRad, elevationRad })` (`orbitController.ts`); `surfaceDirection` (Task 2); `frame.bodyOrientation`; `exploreStore.featureSeq`, `selectedFeatureId` (Task 6); the details store for the feature's latitude and longitude (through `featureEntry(details, id)`, Task 10; until Task 10 lands, read `landmarks` and `features.items` directly and switch in Task 10).
- Produces (in `explore.ts`):

```ts
export const FEATURE_TURN_SECONDS = 0.8;
export const FEATURE_MAX_ELEVATION_RAD = (70 * Math.PI) / 180;   // a polar feature is viewed from 70°, not from straight above (the orbit's up is ecliptic north)
export function exploreEntryAzimuth(bodyId: string, sunId: string | null, bodyKm: Vec3, sunKm: Vec3, currentAzimuthRad: number): number; // litAzimuth, or the current azimuth for the Sun itself or with no Sun
export function featureView(directionWorld: Vec3): { azimuthRad: number; elevationRad: number };   // camera on the feature's side; elevation clamped to ±FEATURE_MAX_ELEVATION_RAD
export function turnStep(from: { azimuthRad: number; elevationRad: number }, to: { azimuthRad: number; elevationRad: number }, t: number): { azimuthRad: number; elevationRad: number }; // eased 0..1; azimuth takes the short way round
```
- [x] **Step 1: Write the failing tests**

```ts
it('enters on the sunlit side, 35 degrees off the Sun', () => { expect(exploreEntryAzimuth('mars', 'sun', [1, 0, 0], [0, 0, 0], 0)).toBeCloseTo(Math.PI + (35 * Math.PI) / 180); });
it('keeps the entry direction for the Sun itself', () => { expect(exploreEntryAzimuth('sun', 'sun', [0, 0, 0], [0, 0, 0], 1.2)).toBe(1.2); });
it('puts the camera over the feature', () => { expect(featureView([0, 1, 0])).toEqual({ azimuthRad: Math.PI / 2, elevationRad: 0 }); });
it('views a polar feature from 70 degrees, with a finite azimuth', () => { const v = featureView([0, 0, 1]); expect(v.elevationRad).toBeCloseTo(FEATURE_MAX_ELEVATION_RAD); expect(Number.isFinite(v.azimuthRad)).toBe(true); });
it('turns the short way round', () => { expect(turnStep({ azimuthRad: 3.0, elevationRad: 0 }, { azimuthRad: -3.0, elevationRad: 0 }, 0.5).azimuthRad).toBeCloseTo(Math.PI, 1); });  // through ±π, not through 0
it('ends exactly on the target', () => { expect(turnStep(a, b, 1)).toEqual(b); });
```
- [x] **Step 2: Run** → FAIL. **Step 3: Implement** the three functions, then in `CameraSystem.tsx`:
  - On Explore entry set `azimuthRad: exploreEntryAzimuth(…)` in the same `setView` call that sets the distance and tilt; compute `r.explore.up` from the **new** azimuth.
  - Keep a `turn: { from, to, startedAt, seq } | null` in the Explore record. When `featureSeq` differs from the last seen and a feature is selected, start a turn to `featureView(apply(orientation, surfaceDirection(lat, lon)))`. Each frame apply `turnStep` through `orbit.setView`; distance is untouched. Under reduced motion apply the target at once. **Any rotate or zoom input cancels the turn** (the user's input is applied that frame). Leaving Explore or changing tab cancels it.
- [x] **Step 4: Add a unit-level test for cancel** in `explore.test.ts` if the turn logic is extracted into a pure reducer (`advanceTurn(turn, nowSeconds, hasInput, reducedMotion)` returning the next turn and view); extract it so it can be tested: with input → `turn: null` and no view change; reduced motion → target at once; `t ≥ 1` → `turn: null` at the target.
- [x] **Step 5: Run** `npx vitest run src/camera` → PASS; `npm run typecheck` → clean. Run `npx playwright test e2e/explore.spec.ts` → all pass (the "scene matches the frame before Explore" test must still pass: the saved pose is restored on leave regardless of the entry azimuth).
- [x] **Step 6: Commit** `feat(camera): Explore opens on the sunlit side; the view turns to a selected feature`.

---

### Task 8: The Explore overlay — tabs, sub-switch, notes, Venus radar

**Files:**
- Modify: `src/ui/explore/ExploreOverlay.tsx` (+ `ExploreOverlay.test.tsx`), `src/styles/explore.css`, `src/state/viewStore.ts` (+ test), `src/scene/materials/BodyMaterial.tsx`, `src/scene/materials/VenusMaterial.tsx`, `e2e/explore.spec.ts`, `e2e/golden.spec.ts`, `e2e/layout.spec.ts`

**Interfaces:**
- Consumes: Task 6's store.
- Produces: `useRadarShown(): boolean` in `viewStore.ts`: `venusRadar || (explore.active && explore.bodyId === 'venus' && explore.view === 'whole')`; both Venus materials use it in place of `venusRadar`. Nothing writes `venusRadar` for Explore, so leaving restores the user's setting by itself.
- Overlay structure:
  - `role="radiogroup"` **`aria-label="Explore section"`**: radios **Surface**, **Interior** (`data-explore-reserved="switch"`), roving tabindex and arrow keys as the old switch.
  - On Interior, below it: `role="radiogroup"` **`aria-label="Interior view"`**: radios **Exploded**, **Half-section** (keys 2 and 3 in their titles), `data-explore-reserved="subswitch"`. In its place while loading, on error (with Retry) or with no interior: the three existing messages, unchanged in wording.
  - Kicker: "Explore · Surface" or "Explore · Interior".
  - Interior notes row (Estimate, not to scale, Illustrative colours): Interior only.
  - Surface notes row (`data-explore-reserved="notes"`): on Venus the tag **"Radar view · not visible light"**; for a body whose ready details have no `features` and no `landmarks`, the text **"No named surface features"**.
  - The composition strip and the chart stay on both tabs.
  - Focus on entry: the checked radio of "Explore section".
  - The switch must hold a third tab later: lay it out with flex and no fixed width, and at 390 px wide three labels of the length of "Interior" must fit on one row (test below).

- [x] **Step 1: Write the failing tests** (`ExploreOverlay.test.tsx`)

```ts
it('shows Surface and Interior, Surface checked on entry', …)
it('shows Exploded and Half-section only on Interior', …)
it('names the kicker after the tab', …)
it('keeps the composition strip on both tabs', …)
it('shows "No interior data yet" on Interior for a body without an interior, and Surface still works', …)
it('shows "No named surface features" on Surface for Jupiter', …)
it('shows the radar tag on Surface for Venus and not on Interior', …)
it('shows no surface note while details load or after a failed load, and does not throw', …)
// viewStore.test.ts
it('useRadarShown is true on Venus Surface in Explore, false on Interior, and follows venusRadar outside Explore', …)
```
- [x] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/ui/explore src/state` → PASS.
- [x] **Step 5: Update the end-to-end tests** that name the old switch: every use of the radio "Whole" becomes "Surface" in the "Explore section" group; tests that click "Exploded" or "Half-section" first click "Interior" unless they arrive by URL or key. Add: `it('three tabs would fit on a phone')` in `layout.spec.ts` — at 390x844 the "Explore section" group is on one row and narrower than 60 % of the viewport (leaving room for a third tab of the same width). Run `npx playwright test e2e/explore.spec.ts e2e/layout.spec.ts` → pass.
- [x] **Step 6: Screenshot check.** With the dev server, shoot `/?jd=2461317.5&pause=1&target=venus&explore=1&quality=high&fx=1` and the same for Mars and Jupiter at 1280x720 and 390x844. Look at each: tabs centred, sub-switch reads as secondary, notes do not collide with the title. Fix and repeat.
- [x] **Step 7: Commit** `feat(explore): Surface and Interior tabs in the overlay; Venus shows its radar map on Surface`.

---

### Task 9: Pins on the globe

**Files:**
- Create: `src/scene/surface/pinAnchors.ts`, `src/scene/surface/pinAnchors.test.ts`, `src/scene/surface/FeaturePins.tsx`, `src/scene/surface/FeaturePins.test.tsx`
- Modify: `src/scene/SceneRoot.tsx` (mount beside `InteriorLabels` and `InteriorLabelProjector`), `src/styles/explore.css`

**Interfaces:**
- Consumes: `surfacePoint` (Task 2); `labelLayout`, `LabelAnchor`, `Rect`, `Size` (`src/ui/explore/labelLayout.ts`); `frame.explore`, `frame.bodyOrientation`, `frame.bodyRenderRadiusKm`, `frame.bodyPositionsKm`, `frame.cameraPositionKm` (as `InteriorLabelProjector` uses them); the store (Task 6); `details.landmarks`, `details.features` .
- Produces (`pinAnchors.ts`, pure):

```ts
export const PIN_FADE = { from: 0.08, to: 0.25 };   // cosine of the angle between the surface normal and the line to the camera
export function pinFacing(pointWorld: Vec3, normalWorld: Vec3, cameraWorld: Vec3): number;   // 0 hidden .. 1 fully shown; smooth between PIN_FADE.from and .to
export interface PinInput { id: string; latDeg: number; lonDegE: number; rank: number }      // rank 0 = best known
export interface PinPoint { id: string; rank: number; offsetWorld: Vec3; facing: number }     // offsetWorld from the body centre, body radii
export function pinPoints(pins: readonly PinInput[], orientation: Mat3, flattening: number, toCameraWorld: Vec3, distanceRadii: number): PinPoint[];
export function pinSide(x: number, bodyX: number): 'left' | 'right';
```
- Produces (`FeaturePins.tsx`): `createPinBridge()`, `FeaturePinProjector({ bridge })` (in the Canvas, `useFrame` priority -0.3 like the interior labels), `FeaturePins({ bridge, catalog })` (DOM, in the label layer).
- Shown pins: the body's landmarks, plus the selected feature when it is not a landmark (the temporary pin).

**Behaviour**
- The projector runs when Explore is active on this body, the store view is `'whole'`, the drawn body is closed (`frame.explore.view === 'whole'` or `progress === 0`) and the chart is closed; otherwise the pin root is hidden.
- Each shown pin: a dot (`button.xpin`, accessible name = the feature name, `aria-pressed` when selected) at its projected point with `opacity = facing`; `facing === 0` → `hidden` and out of the tab order.
- Names (wide screens): `labelLayout` over the pins with `facing > 0.5`, `priority = selected or hovered ? high : (count - rank)`, `full` = measured name size, `collapsed` = the same size (a name has no shorter form), `side = pinSide(…)`, `opts.body` = the body's screen circle, `selectedId`. `mode === 'hidden'` → the dot stays and the name is not shown; hovering or focusing the dot shows the name as a tooltip (`title`).
- Leaders: one SVG line per named pin from the dot to the name, as the interior labels draw them.
- Names fade with CSS (`opacity` transition 150 ms on a data attribute); under `prefers-reduced-motion` no transition.
- Phone (`bridge.narrow`): no names or leaders; each landmark dot shows its number (rank + 1), matching the list in Task 10.
- Click or tap on a dot or a name → `selectFeature(id)`. The pin root's empty space lets clicks through to the scene; **a click on empty space in the scene** (the canvas `onPointerMissed`, or the body itself) clears the selection when a feature is selected.
- Tab order: dots in rank order.

- [x] **Step 1: Write the failing tests**

```ts
// pinAnchors.test.ts
it('a pin facing the camera is fully shown; on the limb and beyond it is hidden', () => { expect(pinFacing([1,0,0],[1,0,0],[5,0,0])).toBe(1); expect(pinFacing([0,1,0],[0,1,0],[5,0,0])).toBe(0); expect(pinFacing([-1,0,0],[-1,0,0],[5,0,0])).toBe(0); });
it('fades between the two thresholds', …)                                  // strictly between 0 and 1 at cosine 0.16
it('places a pole pin on the flattened pole', () => { expect(pinPoints([{ id: 'p', latDeg: 90, lonDegE: 0, rank: 0 }], IDENTITY, 0.9, [1,0,0], 3.4)[0].offsetWorld).toBeCloseToVec([0, 0, 0.9]); });
it('turns with the body orientation', …)                                   // a 90° rotation about z moves lon 0 to +y
// FeaturePins.test.tsx (DOM part, bridge driven by hand)
it('renders one button per landmark, named after it, in rank order', …)
it('adds a temporary pin for a selected feature that is not a landmark, and removes it when the selection clears', …)
it('marks the selected pin pressed', …)
it('shows numbers and no names at phone width', …)
it('renders nothing for a body with no landmarks and no selected feature', …)
// layout, through labelLayout with pin-shaped input
it('names never overlap each other or the reserved rects at 1280x720 and 800x1000, and the selected pin keeps its name', …) // 25 pins at seeded random facing-side positions, reserved = title, tabs, card, list, strip rects
```
- [x] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/scene/surface` → PASS; `npm run typecheck` → clean.
- [x] **Step 5: Screenshot loop.** Dev server; shoot Mars, the Moon, Mercury, Venus and Earth on Surface at 1280x720 from the opening view, and each again after an orbit to another side (a Playwright drag), plus Mars at 390x844. For every landmark dot visible in a shot, compare it with the feature in the image: **the dot sits on the feature**. Check the look against `Assets/m2b4a/mockup-2-pin-styles.png`: names off the globe, thin lines, small glowing dots, nothing on top of the tabs or the strip. Fix and repeat until it looks right. A dot that is off its feature is a bug in the data path or the maths, not something to nudge.
- [x] **Step 6: Commit** `feat(explore): landmark pins on the globe with names and leader lines`.

---

### Task 10: The feature card, the All features list and search

**Files:**
- Create: `src/ui/explore/featureModel.ts`, `featureModel.test.ts`, `src/ui/explore/FeatureCard.tsx`, `FeatureCard.test.tsx`, `src/ui/explore/FeatureList.tsx`, `FeatureList.test.tsx`
- Modify: `src/ui/explore/ExploreOverlay.tsx` (mount both on Surface), `src/styles/explore.css`, `src/camera/CameraSystem.tsx` (use `featureEntry`), `src/ui/DetailsSections.tsx` (keys by `id`)

**Interfaces:**
- Produces (`featureModel.ts`):

```ts
export interface FeatureEntry {
  id: string; name: string; type: string; typeMeaning: { text: string; sourceId: string } | null;
  latDeg: number; lonDegE: number; positionText: string; positionSourceId: string; positionKind: 'gazetteer' | 'names-database' | 'quoted';
  diameterKm: number | null; sizeSourceId: string | null;
  origin: string | null; approvedYear: number | null; gazetteerSourceId: string | null;
  landmark: { rank: number; quote: { text: string; sourceId: string } } | null;
}
export function featureEntries(details: BodyDetails): FeatureEntry[];   // landmarks in rank order, then the other features largest first, ties by name; a landmark that is also in features.items appears once
export function featureEntry(details: BodyDetails | null | undefined, id: string): FeatureEntry | null;
export function searchFeatures(entries: readonly FeatureEntry[], query: string): FeatureEntry[];   // foldText(query) as a substring of foldText(name); an empty query returns all, order kept
export function formatLatLon(latDeg: number, lonDegE: number): string;  // "14.0° S, 301.4° E", one decimal, east 0 to 360
```
`positionText` is `formatLatLon(…)` for the Gazetteer and the source's own text for the other kinds.
- `FeatureCard({ catalog, body, details, featureId, onClose })`: a glass card in the layer card's place and style, `data-explore-reserved="card"`. Rows, each with its `[n]`: kicker (`type · meaning`, plus "Landmark"), name, the quote in quotation marks (landmarks only), Size ("3,761 km", `formatKm`), Position, "Named for" (the Gazetteer `origin`), "Name approved" (year), a Sources list (`SourcesList`, its own id prefix `feature-source-`). A names-database position adds the line **"The position is the names database's point for this name, not a measured centre."** A row whose value is null is not rendered. Close button "Close feature card". The card sets its own `CiteTargetContext` target, as the layer card does.
- `FeatureList({ catalog, body, details })`: a button, **"All features (N) · Search"** (Earth and any body with landmarks but no `features`: **"Landmarks (N)"**), `aria-expanded`, opening a glass panel on the left (`data-explore-reserved="features"`; a bottom sheet at phone width) with a search input (`type="search"`, label "Search features"; not rendered when there are 10 or fewer entries), a count line ("N of M"), and a list of buttons: name, type, size; landmarks carry a "Landmark" mark, and at phone width their number. An empty result shows **"No features match"**. Picking a row calls `selectFeature(id)`; at phone width it also closes the panel. **Esc in the search input closes the panel** (the global hotkey ignores typing targets, so the input handles it). No button for a body with no entries.
- On a phone the card and the panel are bottom sheets and only one shows at a time: opening the card closes the panel.

- [x] **Step 1: Write the failing tests**

```ts
// featureModel.test.ts
it('lists landmarks in rank order, then the rest largest first', …)
it('lists a landmark that is also in the 200 once, with its quote', …)
it('includes a landmark below the size cut', …)                              // Tycho fixture
it('handles a body with landmarks and no features (Earth)', …)
it('returns [] for a body with neither', …)
it('finds "Tycho" from "tycho" and "  TYCHO", and "Brontë" from "bronte"', …)
it('returns everything for an empty query and [] for no match', …)
it('formats a position', () => { expect(formatLatLon(-14.0059, 301.4123)).toBe('14.0° S, 301.4° E'); expect(formatLatLon(0, 0)).toBe('0.0° N, 0.0° E'); });
// FeatureCard.test.tsx
it('shows the quote, size, position, name origin and approval year of a landmark, each with its source number', …)
it('shows no quote for a plain feature', …)
it('shows only what its sources state for an Earth landmark, with the names-database line', …)
it('shows the Latin type with its meaning, and the type alone when no meaning is in the data', …)
it('shows "Crater" and "Satellite Feature" as they are', …)
it('lists and links its sources with the shared citation numbers', …)
// FeatureList.test.tsx
it('opens, lists 200 entries with landmarks first, and filters as you type', …)
it('shows "No features match"', …)
it('is titled "Landmarks (N)" with no search box for Earth', …)
it('picking a row selects the feature', …)
it('Esc in the search box closes the panel', …)
it('renders no button for Jupiter', …)
```
- [x] **Step 2: Run** → FAIL. **Step 3: Implement**; switch Task 7's feature lookup to `featureEntry`. **Step 4: Run** `npx vitest run src/ui src/camera` → PASS; `npm run typecheck` → clean.
- [x] **Step 5: Screenshot loop.** Mars with Olympus Mons selected (`…&explore=1&feature=olympus-mons`), the Moon with Tycho selected, Earth with a landmark selected, Mars with the list open and "pl" typed, at 1280x720; Mars card and list at 390x844. Check: the card matches the layer card's look; the list does not touch the strip or the title; names keep clear of both. Fix and repeat.
- [x] **Step 6: Commit** `feat(explore): feature card, All features list and search`.

---

### Task 11: End-to-end tests, golden views and documentation

**Files:**
- Create: `e2e/features.spec.ts`
- Modify: `e2e/golden.spec.ts`, `e2e/layout.spec.ts`, `README.md`, `docs/SETUP.md` (only if a command changed), vault: `Architecture/ui.md`, `scene.md`, `state.md`, `camera.md`, `core.md`, `pipeline.md`, `Data Sources/USGS Gazetteer of Planetary Nomenclature.md`, `Changelog.md`, `Home.md`, `Start here.md`, `Plans/2026-10-05-m2a1-carry-over.md`, this plan's Execution record, the spec's "Amended while building", the session note
- Add: reviewed images in `Space_visualizer/Assets/m2b4a/`

- [x] **Step 1: Write `e2e/features.spec.ts`** (each test waits for the canvas first, as the existing Explore tests do):
  - Mars: Explore opens on Surface with at least 5 pin buttons visible.
  - Click the "Olympus Mons" pin → a card with that heading, a quoted sentence and a "Sources" list; Esc closes the card; Esc again leaves Explore.
  - Open "All features", type "hellas", pick "Hellas Planitia" → its card opens and a pin named "Hellas Planitia" is visible within 3 s (the camera turned).
  - A non-landmark picked from the list gets a pin; clearing the selection removes it.
  - Interior → Exploded opens, no pin button is visible; Surface → pins return.
  - Earth: at least 5 pins; the list button reads "Landmarks (N)".
  - Jupiter: "No named surface features"; no list button.
  - Venus: the radar tag shows on Surface.
  - `/?target=mars&explore=1&feature=valles-marineris` opens its card; `view=whole` opens Surface.
  - No page errors in any of them.
- [x] **Step 2: Layout.** In `layout.spec.ts`, at the five sizes, on Mars Surface with a card open and the list open: the tabs, title, card, list, strip and ✕ do not intersect each other, and no visible pin name intersects any of them.
- [x] **Step 3: Golden views** in `golden.spec.ts` (`quality=high&fx=1`, reduced motion): `8-mars-surface`, `8b-moon-surface-card` (Tycho selected), `8c-earth-surface`, `8d-venus-surface-radar`, `8e-mars-list` (list open), `8f-phone-mars-surface`. The existing `7*` views are re-shot (the entry direction changed).
- [x] **Step 4: Run the full suite once.** `npm test`, `npm run typecheck`, then `npx playwright test` (about 8 to 10 minutes; one run at a time; if the runner does not exit after its summary, stop that process). Record the counts.
- [x] **Step 5: Review every golden by eye** and copy the reviewed images to `Assets/m2b4a/` (and the re-shot `7*` images to `Assets/m2b3/`).
- [x] **Step 6: Documentation.** Update each note listed above for what this section changed (tabs and keys in `ui.md`; pins in `scene.md`; the store in `state.md`; entry direction and the turn in `camera.md`; `surfacePoint`, `featureId` and the schema in `core.md`; landmarks, names databases and the guards in `pipeline.md`; the Mercury fix in the Gazetteer note and the Changelog). Copy every ruling and deferred minor finding from the progress ledger into the Execution record below and the carry-over note. Mark the carry-over's Venus-mirror item done. README: the Surface tab, pins, the list and the new URL parameters.
- [x] **Step 7: Commit** `test,docs: feature pins end to end, golden views and the vault`.

---

## Execution record

Built 2026-11-15, subagent-driven on branch `m2b4a-pins` (in place, no worktree; base `2876eae`, the docs commit). Implementers: sonnet, with opus for Tasks 4, 5 and 9 (research and visual judgment) and Task 11. Per-task reviews by sonnet; every task finished review-clean (Tasks 4, 8, 9 and 10 after one fix round each). **The whole-branch review is still to do.** Nothing is pushed and no PR is open.

Final counts: 1,197 unit tests in 122 files, typecheck clean, 144 end-to-end tests. The one full end-to-end run passed 137 of 144 in 21.8 minutes on a loaded machine: six tests timed out waiting 5 s for the canvas while the first page loaded (a known flake on a loaded machine) and passed when the failed tests were re-run; the seventh was a new layout assertion that expected a pin name with both the card and the list open at 1280x720, where none fits (see Task 11 under Deferred minor findings). The assertion was corrected and the Surface layout tests pass at all five sizes.

### Commits by task
| Task | Commits | What |
|---|---|---|
| 1 | `78ba9a3` | one Gazetteer row per feature, stable feature ids |
| 2 | `18e7aa4`, `dc2b7e9` | surface point maths; placement guards (then rebuilt on physical priors and feature-sized discs) |
| 3 | `16b85d5` | curated landmarks pipeline, quote checks, type meanings, details schema |
| 4 | `b1e2e7e`, `dbfe430` | landmarks for Mercury, Venus, the Moon and Mars; fix round: better sentences, two dropped |
| 5 | `1e7f431` | Earth landmarks with positions from GNIS |
| 6 | `0448d51` | Explore state: tabs, feature selection, list, URL and keys |
| 7 | `c01d75b` | camera: sunlit entry, turn to a feature |
| 8 | `eb46c40`, `bed9114` | overlay tabs, sub-switch, notes, Venus radar; fix round: focus stays in the overlay |
| 9 | `19a2ce5`, `9f88a67` | pins on the globe; fix round: names hide with the pins, stay on their own side, off-screen dots hidden |
| 10 | `e0454d3`, `2ad9190` | feature card, All features list, search; fix round: Earth type is the GNIS feature class |
| 11 | `c990bf4`, then the `test,docs` commit | hidden interior phone dots fix; end-to-end tests, golden views, this documentation |
| 12 | `e1b44a6`, then the `docs(vault)` commit | Earth landmarks from other official sources (NOAA, GEBCO, NRCan, LINZ); these notes |

### Rulings
Each with its cost if wrong. Copied from the execution ledger.
- **Pre-flight (Tasks 2 to 4):** Task 2 reads `details.landmarks ?? []`, because the field does not exist until Task 3. Cost: none.
- **Task 1:** the build fails on a duplicate feature **id**, not a duplicate **name** (spec §6.1 says name). Every same-name pair found was one feature listed twice (same link), now deduped; two real features sharing a name are legitimate and get distinct ids. Cost: a future Gazetteer file with a new kind of duplicate passes the build with a "-type" id instead of failing.
- **Task 2:** sent back before review. The first guards were chosen by scanning the map and their darker or brighter direction was measured, so they could not prove placement (only freeze it); the cause was fixed 4 to 6 degree discs on features 18 degrees and wider. Asked for: a disc sized from `diameterKm` and the body radius, and a physical prior on every guard (maria dark, facula bright, Syrtis dark, Venus highlands radar-bright); a prior that fails at the true position is reported, not replaced. Cost: one extra round.
- **Task 2:** Argyre Planitia and Caloris Planitia stay as extra guards (named with a prior in the fix message, or carrying a stated one); the strong priors (Syrtis, Hellas, Nathair Facula) already carry each body. Cost: a weak-prior guard fails for a wrong reason later and is dropped.
- **Task 3:** a type-meaning quote may be two table rows run together to reach 6 words (the README's precedent for tables). The UI shows only the meaning and its citation, never the type quote (the built data keeps the meaning and `sourceId` only). Cost: none visible; the quote is a build check only.
- **Task 3:** landmark sources are appended after the Explore-only block in `detailsSourceOrder`, not right after the features sources. Append-only is the binding rule and it holds. Cost: none.
- **Task 4:** "Sea of Tranquility" matches Mare Tranquillitatis (its English name); the fault was only a landing-centred sentence. Cost: none.
- **Task 4:** "Astronaut-named features" is an English Gazetteer type, shown as is, with no meaning entry. Cost: none.
- **Task 4:** stray spaces before punctuation inside quotes stay in the data as the page has them; the display tidies them (`tidyQuote`, Task 10). Cost: a card would show "plains , while".
- **Task 5:** NASA image-centre coordinates are **not** accepted as landmark positions (an image centre is not the feature's position; the spec allows no position read off a picture). Cost: Earth stays without landmarks outside the United States and Antarctica until GNS or another source the user approves is reachable.
- **Task 5:** the build continues with GNIS only. The gap (no landmarks outside the US and Antarctica) is reported to the user as spec §6.2 requires; the user decides: retry GNS from another network, approve another official source, or accept.
- **Task 5:** the GNIS `area` field and the area-file download replace the brief's fetch-one-record interface. GNIS offers no record fetch; it is the same pattern as the planetary Gazetteer zip. Cost: none; the files are 1 to 3 MB.
- **Task 7 (resolved by the controller):** `urlParams` applies `feature=` through `explore.selectFeature`, which bumps `featureSeq`; `enter` spreads the idle state, so the selection clears on a body change.
- **Task 9:** a pin's name that does not fit on its own side is not shown (dot only). A same-side-only option was added to `labelLayout.ts`, default unchanged for the interior labels. Cost: fewer names in dense clusters.
- **Task 9:** pins on the night side keep full brightness, and the turn does not chase the Sun (spec §5.1: pins are interface; real lighting stays). Cost: none.
- **Task 9:** the selected pin is exempt from `sameSideOnly` (it keeps its name even if that means the other side). After the turn it sits near the screen centre, and the spec ranks the selected pin first. Cost: one leader may cross the globe, for the selected pin only.
- **Task 10:** the search box rule is numeric (hidden at 10 or fewer entries), so Earth (21) has one; the brief's test title "no search box for Earth" was wrong. Cost: none.
- **Task 10:** the phone "Close list" link stays (the sheet hides its toggle). Cost: none.
- **Task 10:** an Earth landmark with a names-database position takes its type from the record's `feature_class`, cited to the names database; the curated word is dropped (shown uncited only for a quoted-position landmark, none today). The curated word was being cited to GNIS, which says "Valley" for the Grand Canyon. Cost: less friendly type words ("Summit", "Stream").
- **Task 11:** golden and test dates. Mars uses `jd=2461317.9` (Olympus Mons and Tharsis face the camera; Hellas Planitia is on the far side, so the list test proves the turn). Earth's golden uses `jd=2461317.4`, where North America is on the sunlit side at the opening view; at the usual 2461317.5 the view is the Pacific with the US at the top limb. Dates scouted: Earth 2461317.2 to 2461318.1 in steps of 0.05 to 0.1, and 2461213.2 to 2461213.35 (June: the US is central but under heavy cloud, so not chosen). No app behaviour changed. Cost: none.
- **Task 11:** on a phone the feature card sheet covers the list button (as the layer card covers the Layers button), so the layout check closes the card before opening the list. Cost: none; it is the existing one-sheet-at-a-time design.

### The Mercury duplicate ruling (Task 1)
Measured on `pipeline/raw/gazetteer-*.zip`, approved rows only. Mercury 614 rows, 606 names, 606 links. Mars 2,052 rows, 2,051 names, 2,051 links. Venus and the Moon: no duplicates. Every duplicated name is a same-`link` pair (one feature listed twice); no two features share a name in any of the four targets.

| Target | Name | link | approvaldt | diameters (row 1 / row 2) |
|---|---|---|---|---|
| Mercury | Mirni Rupes | .../Feature/3923 | 1976 | 258.017 / 258.000 |
| Mercury | Kunisada | .../Feature/14585 | 2009/07/09 | 241.45 / 241 |
| Mercury | Lange | .../Feature/14586 | 2009/07/09 | 176.233 / 176 |
| Mercury | Matabei | .../Feature/14587 | 2009/07/09 | 23.5221 / 24 |
| Mercury | Matisse | .../Feature/3750 | 1976 | 189.041 / 189 |
| Mercury | Michelangelo | .../Feature/3881 | 1979 | 229.715 / 230 |
| Mercury | Milton | .../Feature/3906 | 1976 | 180.846 / 180 |
| Mercury | Discovery Rupes | .../Feature/1548 | 1976 | 412 / 412 (lon 322.7585 / 322.7587) |
| Mars | Bohar | .../Feature/16054 | 2022/04/13 | identical rows |

The feature pages (`https://planetarynames.wr.usgs.gov/Feature/<id>`) were fetched (HTTP 200). They list **both** geometry records side by side (plus a control-network record in +West coordinates): Kunisada shows 241.45 km and 241.00 km, Michelangelo 229.72 and 230.00, Matabei 23.52 and 24.00. So the page does not single one row out, and "keep the row matching the page" cannot decide. The fallback was applied: keep the row whose diameter has more decimals (the more exact measurement); a tie keeps the first row (Discovery Rupes, Bohar). The page lists the more precise record first in every case, which agrees. The rule is code (`dedupeRows`), not a name list; rows without a link are never merged.

Result: Mercury 200 items, 200 distinct ids; approved totals Mercury 606 (was 614), Mars 2,051, Venus 1,985, the Moon 9,087. Ids are assigned over all deduped approved features, so `findFeature` returns the id the list would.

### Placement guards (Tasks 2, 4 and 5)
`pipeline/textures/placement.test.ts` runs in `npm test` on the committed 1k maps (`color_1k.webp`; Venus `radar_1k.webp`), with positions from the committed details files by name. Contrast is the mean luminance (0 to 1) of a disc at the feature minus that of a ring around it, by great-circle distance. Each guard is also tested at the mirrored longitude and at the half-turned longitude: for every body at least one guard must fail there, so a mirrored or shifted map fails the test.
- **Constants (Task 2 fix):** angular radius a = (diameterKm / 2) / equatorial radius (`bodies.json`); disc 0.6a (`DISC_FRACTION`), ring 1.3a to 2.0a (`RING_INNER`, `RING_OUTER`); pass at 0.03 in the expected direction (`MIN_CONTRAST`). Not tuned: the starting values worked on every body.
- **First attempt (scan-picked, rejected by ruling):** fixed discs of 3 to 6 degrees; Mare Moscoviense -0.166, Mare Orientale -0.153, Syrtis Major Planum -0.055, Argyre +0.047, Nathair Facula +0.284, Rachmaninoff -0.197, Lavinia Planitia +0.104, Laima Tessera -0.157. The brief's first names failed at their true positions (Mare Crisium -0.013, Syrtis at 4 degrees -0.013, Ovda Regio +0.018), which led to the scan; the ruling replaced the scan with priors.

Final guards and measured contrasts (true / mirrored / half-turn; prior in brackets):

| Body | Guard | Expect | True | Mirror | Half-turn |
|---|---|---|---|---|---|
| Moon | Mare Crisium (mare, dark basalt) | darker | -0.148 | -0.081 | +0.037 |
| Moon | Mare Moscoviense (mare) | darker | -0.213 | +0.039 | +0.001 |
| Moon | Mare Orientale (mare) | darker | -0.186 | +0.028 | +0.008 |
| Moon | Tycho (young rayed craters are bright; Task 4) | brighter | +0.091 | -0.023 | -0.035 |
| Mars | Syrtis Major Planum (classical dark albedo feature) | darker | -0.144 | -0.011 | +0.009 |
| Mars | Hellas Planitia (bright basin floor) | brighter | +0.115 | -0.047 | -0.064 |
| Mars | Argyre Planitia (bright basin floor) | brighter | +0.063 | +0.009 | +0.013 |
| Mercury | Nathair Facula (facula = bright spot) | brighter | +0.392 | -0.000 | +0.001 |
| Mercury | Hokusai (young rayed craters are bright; Task 4, replaces Caloris) | brighter | +0.147 | -0.041 | +0.009 |
| Mercury | Caloris Planitia (removed in Task 4; weaker prior) | brighter | +0.203 | -0.093 | +0.006 |
| Venus | Ovda Regio (rough highland, radar-bright) | brighter | +0.105 | +0.010 | -0.023 |
| Venus | Atla Regio (same) | brighter | +0.090 | -0.014 | +0.006 |
| Venus | Beta Regio (same) | brighter | +0.091 | -0.032 | -0.078 |
| Venus | Maxwell Montes (mountain belts are rough and radar-bright; Task 4) | brighter | +0.224 | +0.095 | -0.015 |

- Every prior held at the true position. The maps agree with `uvForLonLat` (longitude 0 at the centre column, east to the right) on all four bodies, so no rendering fix was needed.
- **Venus, other measurements:** all 8 highland features measured were radar-brighter (Ovda, Atla, Beta, Thetis +0.134, Alpha +0.098, Aphrodite +0.172, Phoebe +0.081, Sudenitsa Tesserae +0.082), and Manatum Tessera +0.055; Fortuna Tessera +0.018, Ishtar Terra -0.009 and Eistla Regio -0.004 were about 0. The planitiae (prior: smooth, radar-dark) gave no consistent sign (Niobe -0.059, Tahmina -0.041, Rusalka -0.031, Lavinia -0.016, Sedna -0.008, Leda +0.004, Guinevere +0.017, Aino +0.016, Atalanta +0.043, Ganiki +0.046, Helen +0.146), so they are not guarded. The earlier "reversed" reading came from the small fixed discs, not a reversed map.
- **Mars:** Terra Cimmeria, Noachis Terra and Olympus Mons show no clear contrast at this scale, so they are not used. **Mercury:** Tolstoj (+0.168) and Rembrandt (+0.144) also read bright, but no prior was claimed for them.
- **Earth (Task 5):** a land-against-water measure on `color_1k.webp` (greyscale): disc radius **0.4 degrees** (about 45 km), fixed; a water pixel has luminance below **0.08**; a guard expecting water needs a water share of at least **0.75**, one expecting land at most **0.25**. Water share true / mirrored / half-turned:
  - Lake Superior (water; the mirror 87.8 E and half-turn 92.2 E at 47.5 N are inland Asia): **1.00 / 0.00 / 0.00**;
  - McMurdo Dry Valleys (land; the mirror is the Ross Sea, the half-turn the ice sheet): **0.00 / 1.00 / 0.00**;
  - Mauna Loa (land; the mirror is open Pacific, the half-turn the Sahara): **0.00 / 1.00 / 0.00**.

  The mirror is caught by all three, the half-turn by Lake Superior only. The brief's prior (land whose mirrored and half-turned longitudes fall on ocean) could not be met: the water share at the half-turned position, at 0.4 and 0.5 degrees, was 0 for all 21 landmarks. Kīlauea at 0.4 degrees was 0.25 water (island edge), so Mauna Loa was used; Larsen Ice Shelf's mirror was 0.5 (coast). Earlier exploratory measures (Rec. 709 luminance and blue share, radii 0.5 to 1.5 degrees) gave the same picture: ocean blue share about 0.71, land 0.11 to 0.28, ice about 0.33.
- This closes the carry-over item "the Venus Maxwell Montes box check may not catch a longitude mirror".

### Landmark research (Task 4, with its fix round)
Method: each page fetched with a plain HTTPS request, run through `pageText`, split into sentences; every sentence holding an approved Gazetteer name of the body (exact, case-sensitive) was read. Names were checked with `findFeature` on the cached Gazetteer rows; the Gazetteer's spelling wins. Web search was used only to find official URLs. Every stored word comes from a fetched page. The quotes themselves are in `pipeline/reference/landmarks.json`.
- **Rank rule (editorial):** first the features the body's NASA overview pages name (`science.nasa.gov/<body>/` and `/facts/`), in page order; then the rest by Gazetteer diameter. Mars: the facts page names Valles Marineris before Olympus Mons, so Valles Marineris is first. Moon: the overview names only Pierazzo, and Orientale only in a caption; the facts page names Tycho, then Clavius. Mercury: the facts page names Caloris and Rachmaninoff (its Debussy mention is an image caption, rejected). Venus: the facts page names Ishtar Terra and Aphrodite Terra.
- **Accepted as page text:** Photojournal and APOD descriptions (the body text of the fetched HTML). About 30 quotes come from such pages.
- **Trims at clean clause edges:** Raditladi (dropped "Shown extending across the top of this high-resolution NAC image,"), Valles Marineris (stops before the page's " ."). Two-sentence quotes: Hellas Planitia, Mare Serenitatis, Planum Boreum, Taurus Littrow Valley. Shared sentence: Ishtar Terra and Aphrodite Terra.
- **Name matches across wording:** "Caloris" basin is Caloris Planitia; "Sea of Tranquility" is Mare Tranquillitatis; "Hadley Rille" is Rima Hadley; "Mount Sharp, also called Aeolis Mons" is Aeolis Mons; "Taurus-Littrow valley" is Taurus Littrow Valley; "Artemis … the largest corona" is Artemis Corona (not Artemis Chasma); "Syrtis Major … one of the darkest regions on Mars" is Syrtis Major Planum (the least certain match).
- **Licence strings:** ESA "ESA; text quoted with attribution (ESA terms of use)"; APOD "NASA Science page; text quoted with attribution". Source URLs are the final URLs after redirects.

**Mars (17).** Pages: the Mars overview and facts pages (`/mars/in-depth/` 404), science.nasa.gov mission pages (Perseverance, Curiosity, Spirit and Opportunity, Pathfinder, Viking 1 and 2, Mariner 9, MGS, Mars Express, MRO, Odyssey, InSight), NSSDCA catalog pages and the Mars fact sheet, the JPL InSight interior article, Space Place, about 20 Photojournal pages (Tharsis, Noctis, Hellas, Arsia, Argyre, Elysium, Syrtis), JPL image pages (Tharsis, Noctis, Mount Sharp, Gale), and three ESA pages (north pole, Argyre twice).
- Kept, in rank order, with the page: Valles Marineris (Mars facts), Olympus Mons (Mars facts), Elysium Planitia (InSight mission), Hellas Planitia (Photojournal "to-great-depths"), Tharsis Montes (Photojournal "tharsis"), Ares Vallis (NSSDCA Pathfinder), Cerberus Fossae (JPL InSight interior), Syrtis Major Planum (Photojournal "syrtis-major-3"), Noctis Labyrinthus (Photojournal PIA03783), Meridiani Planum (Spirit and Opportunity mission), Arsia Mons (Photojournal THEMIS Arsia), Elysium Mons (Photojournal "elysium"), Planum Boreum (ESA north pole dunes and ice), Gusev (NSSDCA Spirit), Gale (NSSDCA Curiosity), Aeolis Mons (JPL PIA16769), Jezero (Perseverance mission).
- Dropped: Utopia Planitia (only a landing-site planning sentence); Chryse Planitia (Viking 1 targeting and landing time only); Argyre Planitia (NASA names only "the large Argyre impact basin" and the map; ESA names it only in titles and metadata); Alba Patera (the Tharsis sentence's 1,600 km volcano is today's Alba Mons; the Gazetteer's Alba Patera is a 66 km caldera); "Tharsis" alone (not a Gazetteer name; Tharsis Montes used); Isidis Planitia (only inside Jezero sentences); Hellas on the MGS page (about a MOLA map); Nili Patera (image locations); Olympia Planum (image framing); Sirenum Fossae (a caption about a nearby crater); Mawrth Vallis, Kasei Valles, Candor Chasma, Planum Australe, Alba Mons, Utopia Rupes and others (no qualifying sentence found).

**Mercury (16).** Pages: the Mercury overview and facts pages, MESSENGER, Mariner 10 and BepiColombo mission and NSSDCA pages, the Mercury fact sheet, Space Place, about 25 Photojournal pages, two science.nasa.gov resources (Apollodorus, Hokusai), two nasa.gov image articles, two ESA pages; the fix round added ESA "Mercury's sunlit north" and Photojournal PIA16857.
- Kept, in rank order: Caloris Planitia (Mercury facts), Rachmaninoff (Photojournal "young volcanism"), Borealis Planitia (ESA sunlit north, fix round), Caloris Montes (Photojournal PIA15065), Enterprise Rupes (nasa.gov image article, the page's own summary line, fix round), Rembrandt (Photojournal), Beagle Rupes (Photojournal), Pantheon Fossae (Photojournal "first fossae"), Mendelssohn (ESA sixth flyby), Nathair Facula (ESA lava and debris), Raditladi (Photojournal, trimmed), Hokusai (science.nasa.gov resource), Prokofiev (Photojournal PIA16857, fix round), Kandinsky (ESA sixth flyby), Apollodorus (science.nasa.gov resource), Fonteyn (ESA lava and debris).
- Dropped: Kuiper (fix round: the only whole sentences name the namesake, refer to an image, or are metadata; pages PIA02411, PIA02236, PIA11355, PIA14528); Debussy (the sentence only says it "can be seen toward the bottom of this image"); Tolstoj, Beethoven, Discovery Rupes (image-description sentences, a naming list); Victoria Rupes and Santa Maria Rupes (a naming list); Carnegie Rupes and Chao Meng Fu (no sentence found); Rustaveli (weak sentences); Suisei Planitia (only the MESSENGER impact site); Alvin Rupes (about the image); Seuss and Ailey (naming only); Tolkien and Gordimer (small; they share Kandinsky's sentence).
- Replaced in the fix round: Enterprise Rupes (dropped "(indicated here with white arrows)"), Borealis Planitia (was "in M-CAM 1's view"), Prokofiev (was a cut sentence with "Mercury' poles"). Kept after review for lack of better: Kandinsky (a list sentence; the alternative is worse), Apollodorus (naming trivia; the alternative is not clearly better), Mendelssohn ("Prominently visible…"; the alternative refers to the image).

**Venus (16).** Pages: the Venus overview, facts, in-depth and crust pages, the Venus lithograph, Space Place, Magellan, Venus Express and Akatsuki mission and NSSDCA pages (the NSSDCA spacecraft pages in the cache have no body text), the Venus fact sheet, about 20 Photojournal pages, two JPL eruption news pages, two NSSDC imgcat pages and a caption file, a nasa.gov image article, APOD 1995 September 28, one ESA page; the fix round added Photojournal PIA00485.
- Kept, in rank order: Ishtar Terra and Aphrodite Terra (Venus facts, one shared sentence), Ovda Regio (Photojournal PIA00146), Niobe Planitia (JPL 2024 news), Atla Regio (JPL 2023 news), Artemis Corona (Photojournal), Lakshmi Planum (Photojournal PIA00249), Alpha Regio (Photojournal PIA00147), Maxwell Montes (NSSDC imgcat), Maat Mons (JPL 2023 news; the eruption sentence chosen over a location sentence), Gula Mons (Photojournal), Mead (NSSDC imgcat), Sacajawea Patera (Photojournal PIA00485, fix round), Sapas Mons (Photojournal), Sif Mons (JPL 2024 news), Cleopatra (Photojournal PIA00149).
- Dropped: Baltis Vallis (the "longest channel" page never names it); Idunn Mons (only an ESA caption fragment); Beta Regio (image strip or crater sentences); Ozza Mons (only inside the Atla sentence); Fortuna Tessera, Danu Montes, Eistla Regio, Clotho Tessera (image-description sentences only); Theia Mons, Diana Chasma, Devana Chasma, Seoritsu Farra (no sentence found).
- Replaced in the fix round: Sacajawea Patera (was "This Magellan image reveals…"; the old page's other sentence has garbled numbers). Kept after review for lack of better: Gula Mons and Sapas Mons (mostly coordinates; the other sentences on their pages are 3-D view framing).

**The Moon (16).** Pages: the Moon overview, facts and composition pages, NSSDCA lunar timeline and Apollo pages (the science.nasa.gov Apollo 11, 15 and 17 pages return 404), LRO and Apollo 8 mission pages, about 10 NSSDC imgcat pages, science.nasa.gov resources (Copernicus, Shackleton, Mare Crisium, Taurus-Littrow, Schrödinger, Aristarchus), four Photojournal pages, about 13 APOD pages, nasa.gov Apollo pages, SVS 4218 and 4302, ESA SMART-1 pages; the fix round added an APOD 2026 July 25 page, ESA "Hadley Rille seen by SMART-1" and the science.nasa.gov Plato volcanic vent page.
- Kept, in rank order: Tycho (Photojournal "the floor of Tycho"), Clavius (APOD 2021 August 5), Oceanus Procellarum (SVS 4218), Mare Imbrium (ESA SMART-1 Cassini), Mare Tranquillitatis (APOD 2026 July 25, fix round), Mare Serenitatis (sci.esa.int SMART-1), Mare Crisium (science.nasa.gov wrinkle ridge), Mare Humorum (ESA SMART-1), Mare Orientale (APOD 2011 March 12), Vallis Schroteri (Photojournal Aristarchus mosaic), Rima Hadley (ESA SMART-1, fix round), Plato (science.nasa.gov volcanic vent, fix round), Copernicus (science.nasa.gov Lunar Orbiter), Aristarchus (science.nasa.gov 3-D resource), Taurus Littrow Valley (SVS 4302, two sentences, fix round), Shackleton (science.nasa.gov "faces of Shackleton").
- Dropped: Schrodinger (fix round: the page's other sentences do not name the basin; no other official page found, only papers and a blog); Montes Apenninus (APOD sentences depend on the photograph; the NSSDC sentence is a fragment); Tsiolkovskiy (never named in its sentence); Von Karman (no sentence; the Chang'e 4 page does not name it); Vallis Alpes and Sinus Iridum (image-referential only); Fra Mauro, Descartes and the Apollo 11 and 12 sites (NSSDC "Landing Site:" data rows, not sentences); Pierazzo (small; a caption); Gruithuisen (the page names the domes, not the crater); Cassini (naming sentences); Lacus Somniorum, Maskelyne, Herodotus, Sulpicius Gallus, Gassendi (image descriptions); Mare Moscoviense, Mare Nubium, Mare Fecunditatis, Mare Nectaris, Kepler, Hertzsprung, Korolev and Apollo (no qualifying sentence found).
- Replaced in the fix round: Mare Tranquillitatis (was the Apollo 11 landing sentence with coordinates), Rima Hadley (was the Apollo 15 landing sentence), Taurus Littrow Valley (a second sentence describing the place added), Plato (was a fragment).

**Type meanings (Tasks 3 and 4).** From the USGS descriptor-terms page (`usgs-gazetteer-descriptor-terms`, https://planetarynames.wr.usgs.gov/DescriptorTerms): 35 Latin types, each the type's table row plus the next row when shorter than 6 words (Rupes takes the row above). Catena "Chain of craters"; Cavus "Hollows, irregular steep-sided depressions"; Chaos "Distinctive area of broken terrain"; Chasma "A deep, elongated, steep-sided depression"; Collis "Small hills or knobs"; Corona "Ovoid-shaped feature"; Dorsum "Ridge"; Facula "Bright spot"; Fluctus "Flow terrain"; Fossa "Long, narrow depression"; Labyrinthus "Complex of intersecting valleys or ridges"; Lacus "Lake"; Linea "A dark or bright elongate marking, may be curved or straight"; Lingula "Extension of plateau having rounded lobate or tongue-like boundaries"; Mare "Sea"; Mensa "A flat-topped prominence with cliff-like edges"; Mons "Mountain"; Oceanus "A very large dark area on the moon"; Palus "Swamp"; Patera "An irregular crater, or a complex one with scalloped edges"; Planitia "Low plain"; Planum "Plateau or high plain"; Regio "A large area marked by reflectivity or color distinctions from adjacent areas, or a broad geographic region" (both senses, fix round); Rima "Fissure"; Rupes "Scarp"; Scopulus "Lobate or irregular scarp"; Serpens "Sinuous feature with segments of positive and negative relief along its length"; Sinus "Bay"; Sulcus "Subparallel furrows and ridges"; Terra "Extensive land mass"; Tessera "Tile-like, polygonal terrain"; Tholus "Small domical mountain or hill"; Unda "Dunes"; Vallis "Valley"; Vastitas "Extensive plain". No meaning for Crater, Satellite Feature or Astronaut-named features (plain English). Per body: Mercury 8, Venus 16, the Moon 11, Mars 25.

**Counts:** first build Mercury 17, Venus 16, the Moon 17, Mars 17 (67, 61 new sources); after the fix round Mercury 16, Venus 16, the Moon 16, Mars 17 (65; 6 sources added, 7 removed). Earth 21 (Task 5). Every body is within 15 to 25.

### Names-database research (Task 5)
- **USGS GNIS (in use).** Documentation: https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data, https://www.usgs.gov/us-board-on-geographic-names/domestic-names, the format document `GNIS_file_format.pdf` (dated October 2, 2026) and the National Map map service description.
  - Options examined: the National Map map service query by `gaz_id` (coordinates only as Web Mercator geometry, reprojected: Grand Canyon came back as -113.99608121336095, 36.112769348344997 against the record's -113.9960696, 36.112764; a valley is a two-point multipoint; rejected, not the record's values); the Domestic Names search app (a JavaScript single-page app with an undocumented backend; rejected); **the staged text files (chosen)**. Sizes: `DomesticNames_AZ_Text.zip` 1.37 MB, CA about 3 MB, HI 0.34 MB, AK 1.47 MB, `DomesticNames_National_Text.zip` 45.93 MB, `Gazetteer_Antarctica_Text.zip` 2.84 MB, `AllNames_National_Text.zip` 21.83 MB (454 MB unzipped).
  - Fetch: `https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_<ST>_Text.zip` and `.../Antarctica/Gazetteer_Antarctica_Text.zip`; no key, login or cookie. The registered source URL is the USGS download page (as for the planetary Gazetteer's S3 zip); the download URL is fixed in code.
  - Format: pipe-delimited UTF-8 with BOM and CRLF, with a header line. Name `feature_name`; position `prim_lat_dec`, `prim_long_dec` (NAD83; 0,0 means unknown, parsed as null). Variants only from the Antarctica names list (the national all-names file is too large to read).
  - Licence: the FGDC metadata in each zip says "Use constraints: None" ("Acknowledgment of the U.S. Geological Survey would be appreciated…"); the map service says "public domain geographic names data". Registered: `Public domain (USGS); GNIS metadata: "Use constraints: None"`.
  - Example (DomesticNames_AZ.txt, 2026-11-15): record 23907 Grand Canyon, class Valley, 36.112764, -113.9960696, stored as 36.112764, 246.0039304 E.
- **NGA GEOnet Names Server (not usable).** `geonames.nga.mil` (both service paths, the home page, `/geonames/GNSData/`) and `earth-info.nga.mil` timed out at TCP connect on every try from 09:55 to 10:31 UTC on 2026-11-15 (7 logged tries); the controller's re-check at about 12:45 also timed out, while `www.nga.mil` answers. WebFetch failed too. No fetch form, format or licence could be read from the official site. Not used instead: GeoNames.org, OpenStreetMap, Wikidata or any mirror. The GNS code paths throw or return null, and a `gns` position fails `verifyLandmarks`.
- **Earth landmarks (21; 13 United States, 8 Antarctica):** Grand Canyon, Mississippi River, Yellowstone Caldera, Mount Saint Helens, Antarctic Peninsula, Death Valley, Kīlauea, Ross Ice Shelf, Lake Superior, Great Salt Lake, Mauna Loa, Mount Erebus, Chesapeake Bay, Crater Lake, Meteor Crater, Vostok Subglacial Lake, Mount Rainier, Vinson Massif, McMurdo Dry Valleys, Thwaites Glacier, Larsen Ice Shelf. Every position is from GNIS; none matched by a variant name; no quoted positions were used. Only Meteor Crater has a size (1.2 km, quoted). The rank interleaves US and Antarctic places so names spread around the globe (editorial). Types are GNIS classes (Task 10 ruling): Valley, Stream, Crater, Summit, Cape, Basin, Glacier, Lake, Bay, Range.
- Dropped: Denali (its GNIS name is now "Mount McKinley"; no NASA sentence uses it); Kilimanjaro, Mount Fuji, Mount Etna, Richat Structure (outside the US; GNS unreachable; the only NASA coordinates are image locations: ruling); Mount Everest (no stated position; a KML gives tile corners only); Great Barrier Reef, Uluru, Lake Eyre (no stated position); Mount Vinson (only a location sentence; Vinson Massif used). Sentences rejected: two Grand Canyon sentences (history-led, astronaut-led), a Great Salt Lake sentence starting "It", a time-bound Kīlauea sentence. The Chesapeake Bay USGS page returned 403 (the NASA page is used). Crater Lake: record 1163669 (Klamath County, OR), one of dozens of that name.
- Decision note [[0010-names-databases-for-earth-positions]]; data note [[Earth names databases (GNIS, GNS)]].

### Tuned values
- **Pins (`pinAnchors.ts`):** `PIN_FADE` from 0.08 to 0.25 (facing cosine); names only for pins with facing above 0.5; `PIN_NAME_LAYOUT` `maxShiftFraction` 0.07 (tried 0.35, then 0.12: the North America cluster fanned out into long steep leaders) and `sameSideOnly`; `PIN_DOT_INSET` 11 px; projector at `useFrame` priority -0.3. Dot: an 18 px invisible button with an 8 px glowing dot; phone dot 22 px. Names and leaders fade over 150 ms (none under reduced motion).
- **Camera (`explore.ts`):** entry azimuth `litAzimuth` (the Tour's lit side, 35 degrees off the Sun's direction); `FEATURE_TURN_SECONDS` 0.8 (smoothstep, short way round; a cut under reduced motion; user input cancels it); `FEATURE_MAX_ELEVATION_RAD` 70 degrees for polar features.
- **List (`FeatureList.tsx`, `explore.css`):** the search box from 11 entries (`SEARCH_MIN`); panel height `100dvh - 270px` (was 330 px, raised after the screenshots).

### Deferred minor findings
Copied from the ledger, by task. The carry-over note has them too ("From M2b.4a").
- **Task 1:** `toItem` returns id `''` and then `allFeatures` mutates it; the shared-name id assignment depends on diameter order; no test for link-less rows never merged, nor for a name folding to an empty id; the duplicate-id check test never showed RED.
- **Task 2:** `bodies.json` parsed once per body in `beforeAll`; `!` on `find` gives a poor error; module-level mutable maps in `placement.test.ts`; the Caloris prior is weak; no `surfacePoint` RED run; Venus planitiae have no consistent radar sign (not guarded); Mercury has no second clean-prior feature.
- **Task 3:** no build-level test for the quoted Earth position path (done in Task 5); `WITH_WORD` accepts an unsigned number after latitude or longitude; the hemisphere-word path could match "10 km east"; no RED run recorded; a README blank line splits the Files list, and one stale sentence.
- **Task 4:** Syrtis Major Planum quoted as "Syrtis Major" (least certain match); Elysium Planitia and Meridiani Planum sentences are mission-led but say something about the place; Mare Imbrium's quote says Orientale is the youngest mare; sizes inside some quotes differ from the Gazetteer size on the same card (Mare Humorum 825 km against 420 km, Artemis 2,100 against 2,600, Mead 280 against 270). Kept for lack of a better sentence: Mercury Kandinsky (a list sentence), Apollodorus (naming trivia), Mendelssohn ("Prominently visible is…" implies an image), Venus Gula Mons and Sapas Mons (mostly coordinates). Typos kept from the pages: Tycho "is an one of".
- **Task 5:** the Meteor Crater quote never names the place; the Yellowstone Caldera quote is about Yellowstone's hydrothermal system; an import sits below a `describe` in `landmarks.test.ts`; the "would be caught" guard tests need only one guard to fail; GNIS points: the Mississippi at its delta, the Grand Canyon at its west end, Antarctic points coarse; Mount St. Helens shown as "Mount Saint Helens"; the half-turn guard rests on one landmark (Lake Superior).
- **Task 6:** the keys 1/2/3 test could not have failed; no RED run; `selectFeature` sets view `whole` without going through `setView`; `featureSeq` is not reset by enter or leave (by design).
- **Task 7:** the turn target has no `EXPLORE_CAMERA.tiltRad` (entry has); a tap-jitter rotate delta in the same frame as a pin click would cancel the turn (Task 9 checked a pin click turns the view); `lastFeatureSeq` is not advanced on an interior tab, so returning to Surface with a feature still selected turns then; near-polar azimuth arbitrary; no test of the `CameraSystem` wiring (end to end only); no RED run.
- **Task 8:** the Venus radar tag waits for ready details while the radar map shows during load; the focus tests call `setTab` rather than a real key event.
- **Task 9:** Mercury's Apollodorus dot about 15 km off the crater centre (likely the Mercury map's alignment; the Moon, Mars and Earth are centred by the same code); Explore opens on the sunlit side, so Earth can open over an ocean (the Pacific at the usual test date), with the US pins bunched at the limb; per-frame allocations in the projector (objects, a Map, a filter array; at most 22 pins); the `fonts.ready` callback is not cancelled on unmount; the 25-pin layout test uses synthetic reserved rects; a dot within 11 px of the viewport edge disappears (`PIN_DOT_INSET`); a missing dot counts as shown for naming (no effect); a selected feature can land on the night side (the turn ignores the Sun; ruled).
- **Task 9 (older code, fixed in Task 11):** the interior phone dots (`.xdot`) had the same hidden-but-drawn CSS problem. Confirmed (a hidden `.xdot` computed `display: grid` and sat at 0,0) and fixed in `c990bf4` with an end-to-end check.
- **Task 10:** `cite()` returns null silently when a source has no number; the circular import of `useNarrowViewport` from `ExploreOverlay` (existing pattern); no render-level accent-folding test; the `FeatureList` open-focus effect on remount.
- **Task 11:** on a phone two numbered dots overlap where two landmarks share a spot (Gale 15 under Aeolis Mons 16 in golden 8f; Hawaii's two volcanoes); this follows the Task 9 decision that a phone dot sits on its feature. With the list open on a desktop, left-side names give way to dots (same-side rule). The Moon golden shows a faint dot near the night-side limb (it appears to be a landmark near the limb, faded by `PIN_FADE`; not checked dot by dot). With both the card and the list open at 1280x720 no pin name fits, not even the selected pin's: the list covers the left name column (x 16 to 336), the card the right one (x 924 to 1264, down to y 563), and a name may move only 7 % of the height. Measured on Mars at `jd=2461317.9` with Olympus Mons selected; at 1024x768 one name (Noctis Labyrinthus) still fits below the card. The card carries the selected name, so nothing is lost, but the globe reads bare. Widening `maxShiftFraction` for the selected pin, or letting it sit over the globe, would be a design call.

### Whole-branch review (2026-11-15)
Range 12d34ae..9718c90 (20 commits). **Verdict: with fixes.** The accuracy chain from source to pixel held and no citation fault was found. Two Important findings, both fixed in commit `b0673de` (the fix wave):
1. **A failed or slow details load was invisible on Surface** (a regression: before this branch the loading line and Retry were always shown). Fix (F1): the Surface notes row shows "Loading surface features…" (`role="status"`) and, after a failed load, "Could not load the surface features." with Retry (`role="alert"`). The Interior messages are unchanged.
2. **An unknown `feature=` id left an invisible selection** that swallowed the first Esc, and the camera looked it up every frame. Fix (F2): once the details are ready, `isUnknownFeature` clears the id (an effect in `Overlay`); the camera advances `lastFeatureSeq` for a settled unknown id. While details load the id is kept.

Minor fixes, same commit: F3 the pin projector reads the reserved rects before it writes; F4 a Gazetteer landmark takes the Gazetteer row's id (`data:offline` gives the same ids; only timestamps changed); F5 Earth card positions (see the ruling); F6 Esc in the list search closes an open card first, then the list; F7 pins fade in (a 200 ms CSS animation on `data-shown`, none under reduced motion; hiding immediate); F8 the `surfaceDirection` docstring; F9 `featureTurnPlan` (extracted from `CameraSystem`) is tested for the tab change; F10 the phone layout checks must find `reserved:card` and `reserved:features`. **F11 (keyboard reach of the pins) was not done:** the pins sit in the scene's isolated label layer, below the overlay; Tab reaches them only if they move out of it, which changes what is drawn on top of what. The list is the full keyboard path; it stays in the carry-over note.

**Ruling (F5):** a names-database position is shown with degree signs and hemisphere letters, keeping the record's own digits: `36.112764° N, 113.9960696° W` (a minus sign becomes S or W; nothing is rounded). Done at display time by `formatRecordPosition`; the stored data is unchanged. Cost if wrong: none to the data.

**Declined to judge (the reviewer's list):**
- Retrying GNS or adding Earth landmarks outside the US: open for the user (Task 5).
- Friendlier Earth type words than the GNIS classes: open for the user (Task 10).
- No pin name fitting with both panels open at 1280x720: a design call the ledger already names.
- A quote's size differing from the Gazetteer size on the same card (Humorum, Artemis, Mead, Caloris 1,550 against 1,500): the user's to weigh; both values are cited.
- Editorial quality of the kept quotes beyond those named (Nathair Facula, Fonteyn, Sif Mons are now in the session note's list): the user's call.
- No credit or citation for the Magellan radar imagery inside Explore: the spec asks only for the tag.
- Golden images: not viewed by the reviewer; the build says they were reviewed by eye.
- Orientation of the higher local texture tiers: the spec scopes the guards to committed files.
- Parametric against planetocentric latitude on the oblate mesh (at most about 0.17°, about 10 km on Mars): the spec says pins follow the drawn shape, and the texture uses the same mapping.

Not fixed, in the carry-over note: `schemaVersion` stays 1 although three fields became required; `WITH_WORD` and "10 km east" parsing before the first quoted position is added.

### Scoped re-review of the fix wave (2026-11-15)
All of F1 to F10 addressed; no new Critical or Important breakage. F11 (Tab reaching the pins) was left for a reason the re-reviewer accepted: the pins sit in the scene's isolated label layer under the overlay, and moving them changes what draws on top of what. One new minor: when a body's details are missing or failed, the camera's feature lookup stays pending and runs a cheap check each frame (it builds no list; selecting a feature needs ready details anyway).

Final numbers, run by the controller on the final commit: **1,211 unit tests in 122 files, typecheck clean.** End-to-end: the fix wave's run of `features`, `explore` and `layout` passed 77 of 77; the last full run (before the fix wave) passed 137 of 144 in one pass on a loaded machine, with the six canvas-wait timeouts passing on rerun and one new layout assertion corrected.

Rulings made in the final review, beside those above:
- **`schemaVersion` stays 1** although `landmarks`, `featureTypes` and `FeatureItem.id` became required. The app and its data ship together, and the plan left it to the builder. Cost if wrong: a stale cached details file fails to parse; since F1 that shows as a load error with Retry.
- **Not fixed, left for the user or later:** no Magellan credit inside Explore (the spec asks only for the tag); the landmark sentences that point at an image (Nathair Facula, Fonteyn, Sif Mons) are listed for the user, not dropped. No cost.

### Task 12 (2026-11-15): Earth landmarks from other official sources
**Why:** GNS could not be reached, so Earth had landmarks only in the United States and Antarctica. The user: "it didn't work use other official sources that have similar data". The controller's ruling on what counts as an official position source is in [[0010-names-databases-for-earth-positions]] (second decision). Built 2026-11-16.

**Research log (condensed; the full log is in the task report in the execution ledger):**
- **NOAA NCEI Volcano Locations (used, worldwide).** Docs: https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/volcanoes. Fetch one record: `https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/volcanolocs/<id>` (JSON; the list has 1,609 records in 9 pages of 200; `name=` does not filter). Fields: `id`, `name`, `country`, `latitude`, `longitude`, `morphology`. Licence (NCEI metadata via doi:10.7289/V5JW8BSH): "Access to this dataset is unrestricted." Example: 10106 Etna, Stratovolcano, 37.748, 14.999.
- **IHO-IOC GEBCO Gazetteer of Undersea Feature Names (used, worldwide).** Docs: https://www.gebco.net/data-products/undersea-feature-names; API documented at `https://www.ngdc.noaa.gov/gazetteer/docs/api/v1` (OpenAPI 3.1). Fetch: `https://www.ngdc.noaa.gov/gazetteer/api/v1/feature?featureId=<id>` (`/feature/<id>` takes the changing state id). Fields: `name` (specific term), `genericTerm`, `approvalState`, `singlePointLatitude`, `singlePointLongitude`. Licence: "Please include the following citation when data from the gazetteer are used or reproduced…: IHO-IOC GEBCO Gazetteer of Undersea Feature Names, www.gebco.net" (gebco.net and NCEI's ArcGIS item). Example: 563 Challenger + Deep, 11.373333, 142.591667. The controller's 403 did not repeat.
- **NRCan Canadian Geographical Names Database (used, Canada only).** Docs: https://natural-resources.canada.ca/maps-tools-publications/maps/geographical-names-canada/download-geographical-names-data. Fetch: `https://geogratis.gc.ca/services/geoname/en/geonames/<KEY>.csv` and the code list `.../codes/concise.json`. Fields: `id`, `name`, `concise.code`, `province.code`, `latitude`, `longitude`. Licence (same page): "Use of the data is subject to the Open Government Licence - Canada." (open.canada.ca rejected the fetcher.) Example: OAHKV Hudson Bay, BAY, province 62, 60.0, -86.0.
- **LINZ New Zealand Gazetteer (used, New Zealand only).** Docs: https://www.linz.govt.nz/products-services/place-names/place-names-new-zealand. Fetch: the whole `https://gazetteer.linz.govt.nz/gaz.csv` (about 21 MB, 54,748 records; record pages are a browser app). Fields: `name_id`, `name`, `feat_type`, `land_district`, `crd_latitude`, `crd_longitude`. Licence: https://www.linz.govt.nz/copyright, "…licensed under the Creative Commons Attribution 4.0 International licence"; LINZ Data Service layer 51681 says CC BY 4.0. Example: 7297 Aoraki/Mount Cook, Hill, Canterbury, -43.595348, 170.141926.
- **Australia, Composite Gazetteer (not used).** The Geoscience Australia map service works (fields `name`, `feature`, `latitude`, `longitude`), but no licence is stated: data.gov.au "notspecified", the WFS "AccessConstraints: Geoscience Australia", the catalogue record 403. Geoscience Australia's CC BY 4.0 excludes third-party content, and the names belong to the state authorities. Open for the user.
- **Not tried again or not allowed:** UNESCO World Heritage (Cloudflare 403 for the controller); the NGA server (Task 5); ArcGIS Online copies of the GEBCO data (commercial platform); GeoNames.org, OpenStreetMap, Wikidata (not allowed).

**Code:** `NAMES_SOURCES` in `pipeline/sources/namesDatabase.ts`, one entry per database (`spec`, `host`, `coverage`, `country` for national ones, `files`, `read`; GNIS also `needsArea`; GNS `notInUse`). `run.ts` fetches each file once (zip entries or text) through the cached fetchers. `verifyLandmarks` checks: unknown database, not in use, GNIS area, an `area` on a non-GNIS entry, the record cited on its own database's host, the name, and a national record's territory. `POSITION_HOSTS` is now the official hosts plus the registry's hosts. GNIS output is unchanged (checked: `data:offline` before adding data changed only timestamps). Card positions read correctly for every new text form (`60.0, -86.0`, `-8.25, 118`) with no code change.

**Landmarks added (22; Earth now 43):**

| # | Name (the record's) | Database:id | Type | Position text | Sentence page |
|---|---|---|---|---|---|
| 2 | Fujisan | noaa-volcano:80303 | Stratovolcano | 35.361, 138.728 | EO Mount Fuji, Japan (39099) |
| 3 | Kilimanjaro | noaa-volcano:20215 | Stratovolcano | -3.07, 37.35 | EO Mount Kilimanjaro Closeup (4708) |
| 4 | Challenger Deep | gebco:563 | Deep | 11.373333, 142.591667 | USGS This Dynamic Earth, Understanding plate motions |
| 6 | Etna | noaa-volcano:10106 | Stratovolcano | 37.748, 14.999 | EO A Long View of Mount Etna (151977) |
| 7 | Vesuvius | noaa-volcano:10102 | Complex volcano | 40.821, 14.426 | EO A View of Vesuvius (149298) |
| 8 | Hudson Bay | nrcan:OAHKV | Bay | 60.0, -86.0 | EO Rebounding in Hudson Bay (147405) |
| 11 | Mariana Trench | gebco:1870 | Trench | 16.9797, 147.8342 | EO New View of the Deepest Trench (77640) |
| 12 | Krakatau | noaa-volcano:60200 | Caldera | -6.101, 105.423 | EO Krakatau, Indonesia (47143) |
| 14 | Aoraki/Mount Cook | linz:7297 | Hill | -43.595348, 170.141926 | EO The Spine of South Island (149512) |
| 15 | Mid-Atlantic Ridge | gebco:1990 | Ridge | -0.3194, -21.47372 | USGS This Dynamic Earth, Understanding plate motions |
| 18 | Pinatubo | noaa-volcano:703083 | Stratovolcano | 15.13, 120.35 | EO Global Effects of Mount Pinatubo (1510) |
| 19 | Eyjafjallajokull | noaa-volcano:170202 | Stratovolcano | 63.633, -19.633 | EO Ash Plume across the North Atlantic (43670) |
| 21 | Bay of Fundy | nrcan:CANGC | Bay | 44.945579, -65.386626 | EO High and Low Tides in Bay of Fundy (6650) |
| 23 | Popocatepetl | noaa-volcano:140109 | Stratovolcano | 19.023, -98.622 | EO Topography of Popocatépetl (6073) |
| 24 | Tambora | noaa-volcano:60404 | Stratovolcano | -8.25, 118 | EO Mount Tambora Volcano (39412) |
| 27 | Chimborazo | noaa-volcano:1502071 | Stratovolcano | -1.469, -78.817 | NASA APOD 2016 February 25 |
| 29 | Nyiragongo | noaa-volcano:20303 | Stratovolcano | -1.52, 29.25 | EO Nyiragongo Vents Steam (7659) |
| 31 | Tenerife | noaa-volcano:180303 | Stratovolcano | 28.271, -16.641 | EO Tenerife, Canary Islands (88659) |
| 33 | Réservoir Manicouagan | nrcan:EHDCW | Lake | 51.381357, -68.298777 | EO A Modern Lake in an Ancient Crater (149414) |
| 35 | Puerto Rico Trench | gebco:2520 | Trench | 19.9214, -65.3933 | USGS Open-File Report 2004-1400 |
| 36 | Whakaari / White Island | linz:6961 | Island | -37.520974, 177.183931 | EO Another Puff from Whakaari (153818) |
| 40 | Cratère des Pingualuit | nrcan:EQZQV | Crater (size 3.44 km, quoted) | 61.2775, -73.6636111 | EO Pingualuit Crater, Canada (8472) |

Quotes were copied from the fetched page text by start and end anchors and checked with the pipeline's own `quoteOnPage`; names were taken from the fetched records. The rank is editorial (best known first): the 21 GNIS landmarks keep their relative order and the new ones are merged in by how well known they are.

**Coverage now:** North America (United States, Canada, Mexico), South America (Chimborazo), Europe (Etna, Vesuvius, Eyjafjallajokull), Africa (Kilimanjaro, Nyiragongo, Tenerife), Asia (Fujisan, Krakatau, Pinatubo, Tambora), Oceania (Aoraki/Mount Cook, Whakaari / White Island), Antarctica; the Pacific (Challenger Deep, Mariana Trench) and the Atlantic (Mid-Atlantic Ridge, Puerto Rico Trench). **Not covered:** Australia (no licence stated), the Indian and Arctic Oceans (no sentence picked), and famous wide places with no reachable official point record: the Himalaya and Mount Everest, the Sahara, the Amazon, the Nile, the Great Barrier Reef, Uluru, Lake Eyre, the Richat Structure.

**Dropped:** Milford Sound (in LINZ; no official sentence found), Mount Logan (in NRCan; NASA names it only in passing), Southern Alps (the NASA sentence describes the image), East Pacific Rise and Emperor Seamounts (in GEBCO; no sentence that reads on its own), Erta Ale ("…located in this rift zone…"), Cotopaxi (no usable sentence), Kilimanjaro's "triple volcano" sentence (the page has "lasterupted"), Manicouagan's first page ("about212"), Chimborazo's Earth Observatory sentence (starts "Although it is…"), Pinatubo on NASA SVS (HTTP 503 at the time; replaced by Earth Observatory), the USGS Pinatubo fact sheet ("of this century", from 1997), the Puerto Rico Trench "deepest part" sentence (it carries "( Figure 2 )").

**Rulings (each with its cost if wrong):**
1. **A GEBCO name is the specific and generic terms joined** ("Challenger" + "Deep"), with the specific term as a listed name. Cost if wrong: four names would read "Challenger", "Mariana", "Mid-Atlantic", "Puerto Rico".
2. **NOAA "Unknown" morphology is no class,** so such a record fails the build. Cost if wrong: none today (no such record is used).
3. **NRCan type is the concise code's term** from the database's own code list (`BAY-Bay` → "Bay"); the code list is a second cached file. Cost if wrong: types read "BAY-Bay".
4. **National scope is checked on the record's own territory field** (NRCan province code, LINZ land district), not on its coordinates. Cost if wrong: a record whose territory field is wrong would pass; none of ours.
5. **Each record must be cited to its own database's host,** stricter than "any position host". Cost if wrong: none.
6. **The cited GEBCO source is gebco.net,** as GEBCO asks, though the records are fetched from NOAA NCEI. Cost if wrong: one URL in sources.
7. **Australia not used** for want of a stated licence. Cost if wrong: Uluru, Lake Eyre and the Great Barrier Reef could have been added; open for the user.
8. **Record names kept as the databases write them** (Fujisan, Popocatepetl, Eyjafjallajokull, Tenerife for Teide, Réservoir Manicouagan). Cost if wrong: less familiar names on some cards.

**Placement guards:** measured every Earth landmark (disc 0.4°, water below luminance 0.08). Added Hudson Bay (water; true 1.00, mirrored 0.00, half-turned 0.00: central Siberia at both) and Fujisan (land; 0.00, 1.00, 1.00: the open North Pacific and North Atlantic). The Earth mirror and half-turn tests now need at least two guards to catch, so the half-turn no longer rests on Lake Superior alone. Whakaari / White Island measures as water (1.00) on the 1k map: the island is smaller than the disc, so an island volcano cannot be a land guard at this resolution. Kilimanjaro (0.00, 1.00, 1.00) and the Mid-Atlantic Ridge (1.00, 0.00, 1.00) also discriminate and are spare.

**Counts:** 1,231 unit tests (122 files), typecheck clean, `npm run data` and `npm run data:offline` clean (208 sources). End-to-end `features` and `golden`: 44 of 44 in one run. The Earth golden `Assets/m2b4a/8c-earth-surface.png` was re-shot (new pins: Popocatepetl, Puerto Rico Trench, Chimborazo; "Landmarks (43)"). Screenshots of Earth from three sides and three cards were looked at: each new dot sits on its place (Fujisan on Honshu, Whakaari off the Bay of Plenty, Hudson Bay mid-bay, Challenger Deep southwest of Guam).

#### Task 12 review (2026-11-16)
The task review (Sonnet) found no Critical issue and the 21 GNIS landmarks unchanged (checked by script). Verdict: needs fixes, three Important and some Minor.
- **Fixed: the country check failed open.** A national record with no territory field passed the check. No real reader produced one, but the rule must not depend on that. The check now treats a missing territory as empty, which fails; one test added.
- **Fixed: the Whakaari sentence had lost its full stop.** The stored quote now ends "…Whakaari/White Island ." with the page's own spacing (the link ends before the stop, as with "Vesuvius ,"); the card tidies the space.
- **Ruling, not fixed: the Tenerife and Aoraki/Mount Cook sentences stay.** The reviewer found that neither stands fully on its own. Each page was searched again: neither holds a better sentence. They are listed for the user with the other weak sentences. Cost if wrong: two cards read less clearly until a better page is found.
- **Deferred minors:** Pinatubo's sentence does not say it was an eruption; a bad record id or GNIS area in `pipeline/run.ts` shows only as "record not found", without the reason; the LINZ scope test is "has a land district", not a list of districts; `parseCsv` has one test.

Numbers after the fixes, run by the controller: 1,231 unit tests in 122 files, typecheck clean, `npm run data:offline` clean (208 sources). No end-to-end rerun: the fixes change one build check and one full stop.

The execution ledger (`.superpowers/sdd/2026-11-15-m2b4a-feature-pins/`, git-ignored) is kept until the user says it can go: it holds the full task reports and research logs that this record condenses.
