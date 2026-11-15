---
title: M2b.4a Feature pins — Implementation Plan
date: 2026-11-15
status: draft (for the user's review)
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

- [ ] **Step 1: Find the cause and write the ruling.** For each duplicated Mercury pair and the Mars pair, print both rows' `link`, `approvaldt`, `diameter`. Decide per pair: same `link` means one feature listed twice; different `link` means two features that share a name. For same-feature pairs, fetch the feature's Gazetteer page (`link`) and keep the row whose diameter and centre match the page. Record the pairs, the links and the kept rows in this note's Execution record. If the page cannot be fetched, keep the row with more decimal places in `diameter` and say so in the record.

- [ ] **Step 2: Write the failing tests**

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

- [ ] **Step 3: Run them.** `npx vitest run src/core/details pipeline/sources/gazetteer.test.ts` → the new tests FAIL.

- [ ] **Step 4: Implement.** `foldText`: NFD, strip combining marks, lower case, trim. `featureId`: `foldText`, runs of non-alphanumerics to `-`, trim `-`. `dedupeRows`: one row per `link` (the kept row per Step 1's ruling, encoded as a rule, not a name list, where the ruling allows). `selectFeatures` runs `dedupeRows` first, counts `totalApproved` after it, and sets `id`; a second feature with the same id gets `-<folded type>`. `findFeature`: exact, case-sensitive match on the clean name among approved, deduped rows. `checkDetails`: duplicate feature id is an error.

- [ ] **Step 5: Rebuild and verify.** `npm run data:offline` → "Wrote 10 bodies…". Then `node -e "const f=require('./public/data/solar-system/details/mercury.json').features;console.log(f.items.length,new Set(f.items.map(i=>i.id)).size,f.totalApproved.value)"` → `200 200 606` (or the count Step 1's ruling gives; record it). `npm test` and `npm run typecheck` → pass.

- [ ] **Step 6: Commit** the task's files and the regenerated data: `fix(data): one Gazetteer row per feature, with stable feature ids`.

---

### Task 2: Surface point maths and the placement guards

**Files:**
- Create: `src/core/frames/surfacePoint.ts`, `src/core/frames/surfacePoint.test.ts`, `pipeline/textures/placement.test.ts`

**Background:** body meshes are a unit `SphereGeometry` rotated `rotateX(Math.PI / 2)` and scaled `(Re, Re, Rp)` (`src/scene/BodyMesh.tsx`); `uvForLonLat(lonDeg, latDeg)` in `src/scene/materials/bodyUniforms.ts` gives `u = lon/360 + 0.5`, `v = 0.5 + lat/180`. So image longitude 0 is at the map's centre column and the object-space direction of (lat, lon east) is `(cos lat · cos lon, cos lat · sin lon, sin lat)`. Whether **each committed map** really has longitude 0 at its centre and east to the right is what the guards prove.

**Interfaces:**
- Produces: `surfaceDirection(latDeg: number, lonDegE: number): Vec3` (unit, body-fixed); `surfacePoint(latDeg: number, lonDegE: number, flattening: number): Vec3` (body radii; `flattening` = polar over equatorial radius; `[cos lat · cos lon, cos lat · sin lon, flattening · sin lat]`).

- [ ] **Step 1: Write the failing unit tests**

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

- [ ] **Step 2: Run** `npx vitest run src/core/frames/surfacePoint.test.ts` → FAIL (module missing). **Step 3: Implement.** **Step 4: Run** → PASS.

- [ ] **Step 5: Write the placement guard** `pipeline/textures/placement.test.ts`. It reads the committed 1k maps with `sharp` (`public/textures/<body>/color_1k.webp`; Venus: `public/textures/venus/radar_1k.webp`) and feature positions from the committed details files (`features.items`, then `landmarks` once Task 4 adds them), by name. For a feature at (lat, lon) it compares the mean luminance of a disc of angular radius `r` at `uvForLonLat(lon, lat)` with the ring from `r` to `2r` around it.

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

- [ ] **Step 6: Run** `npx vitest run pipeline/textures/placement.test.ts` → PASS for all four bodies. **If a body fails at the true position**, the map's longitude origin or direction differs from `uvForLonLat`: stop, report it (it is a rendering bug older than this section), and fix it only with a ruling in the Execution record.

- [ ] **Step 7: Commit** `test(textures): surface point maths and placement guards on the committed maps`.

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

- [ ] **Step 1: Write the failing tests**

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

- [ ] **Step 2: Run** `npx vitest run pipeline/sources/landmarks.test.ts pipeline/build src/core/details src/ui/citations.test.ts` → the new tests FAIL.

- [ ] **Step 3: Implement.**
  - `parseStatedPosition`: two numbers, each with a hemisphere letter (N/S, E/W), the words north/south/east/west, or the words latitude/longitude with a sign; degrees with optional minutes (`°`, `′` or `'`); output decimal degrees rounded to 4 places, `lonDegE` in [0, 360); `text` is the matched span as written.
  - `verifyLandmarks`: registered and official-host sources, no `kind: 'paper'`, quote on page and ≥ `MIN_QUOTE_WORDS`, type-meaning quotes on their page and containing both the type and the meaning, quoted positions equal to `parseStatedPosition(quote)`, sizes pass `quoteHasKm`.
  - `buildDetails`: verify the file; per body build `landmarks` in file order with `id = featureId(name)`; Gazetteer bodies via `findFeature` on the body's rows (error if missing); Earth via `earthPositions` or the quoted position; `featureTypes` for the types that the body's `features.items` and `landmarks` use and the file defines; add landmark sources through the existing curated-source aliasing.
  - `run.ts`: read `landmarks.json`, fetch each source page into the cache as `ref-<sourceId>.html` (the existing loop), pass `landmarks` and an empty `earthPositions`.
  - `detailsSourceOrder` (`src/ui/citations.ts`): after the features sources, append, in order, each landmark's `quote.sourceId`, `position.sourceId`, `sizeSourceId`, then each `featureTypes` source.
  - `landmarks.json` starts with **two** Mars landmarks (Olympus Mons, Valles Marineris) and one type meaning, each with a real quote found on an official page and already in the cache, to prove the path end to end.
  - README: a "Landmarks" section with the file shape, the two-things rule (a sentence worth showing, an official position), the position rule and the no-papers rule.

- [ ] **Step 4: Run** the tests → PASS. `npm run data` (network, for the new pages), then `npm run data:offline` → both write 10 details files. `npm test`, `npm run typecheck` → pass.

- [ ] **Step 5: Commit** `feat(data): curated landmarks with quote checks, type meanings, and the details schema for them`.

---

### Task 4: Landmarks for Mercury, Venus, the Moon and Mars

**Files:**
- Modify: `pipeline/reference/landmarks.json`, `pipeline/textures/placement.test.ts`
- Regenerate: `public/data/solar-system/details/{mercury,venus,moon,mars}.json`, `public/data/sources.json`

**Interfaces:** consumes Task 3's file format. Produces 15 to 25 landmarks per body in rank order, and the type meanings.

- [ ] **Step 1: Research, with a log.** For each body, start from NASA's own overview pages for it (science.nasa.gov planet and Moon pages, NASA mission pages, USGS Astrogeology, ESA) and list the surface features they name. A feature qualifies when (a) one of those pages has a sentence about it of 6 or more words that is worth reading on a card, and (b) its exact name is an approved Gazetteer feature of that body (check with `findFeature` on the cached rows; the Gazetteer's spelling wins). Keep a log in the Execution record: page searched, features found, features rejected and why (no sentence, name not in the Gazetteer, sentence only in an image caption that is not on the fetched page).
- [ ] **Step 2: Rank.** Order each body's list best known first: the features NASA's overview page for the body names first, then the rest by size. The order is editorial; say so in the log.
- [ ] **Step 3: Type meanings.** From the USGS Gazetteer's descriptor-terms page (host `usgs.gov`), add a `types` entry for every Latin type that the four bodies' features and landmarks use (`node -e` over the details files lists them). A row shorter than 6 words is quoted together with a neighbouring row, as the README allows for tables. If the page cannot be fetched or quoted, leave `types` empty and record it; the card then shows the Latin type alone (spec §5.3).
- [ ] **Step 4: Build.** `npm run data` → no errors. Fix every quote the check rejects by re-copying the sentence from the cached page; never edit a quote to pass.
- [ ] **Step 5: Counts.** `node -e` prints the landmark count per body. Target 15 to 25. **Fewer than 8 on any body: stop and report to the user** (spec §6.2).
- [ ] **Step 6: Tighten the guards.** With landmarks now in the data, replace any weak guard feature from Task 2 with a better landmark (for example a bright rayed crater), keep the mirror and half-turn tests passing, and update the Execution record. `npx vitest run pipeline/textures/placement.test.ts` → PASS.
- [ ] **Step 7:** `npm run data:offline`, `npm test`, `npm run typecheck` → pass. **Commit** `feat(data): landmarks for Mercury, Venus, the Moon and Mars`.

---

### Task 5: Earth landmarks and the names databases

**Files:**
- Create: `pipeline/sources/namesDatabase.ts`, `pipeline/sources/namesDatabase.test.ts`, `Space_visualizer/Decisions/0010-names-databases-for-earth-positions.md`, `Space_visualizer/Data Sources/Earth names databases (GNIS, GNS).md`
- Modify: `pipeline/sources/landmarks.ts` (+ test), `pipeline/run.ts`, `pipeline/reference/landmarks.json`, `pipeline/reference/README.md`, `pipeline/textures/placement.test.ts`
- Regenerate: `public/data/solar-system/details/earth.json`, `public/data/sources.json`

**Interfaces:**
- Produces: `POSITION_HOSTS = [...OFFICIAL_HOSTS, 'nga.mil'] as const` (in `landmarks.ts`); `namesRecordUrl(database: 'gnis' | 'gns', recordId: string): string`; `parseNamesRecord(database, body: string): { name: string; latDeg: number; lonDegE: number; text: string } | null`; `namesSourceSpec(database): SourceSpec` (ids `usgs-gnis`, `nga-gns`).
- `run.ts` fills `earthPositions` by fetching each `names-database` landmark's record into `pipeline/raw/names-<database>-<recordId>.<ext>` through the existing cached fetch.

- [ ] **Step 1: Research the two databases, and write the ruling.** Find, on the official sites only (USGS for GNIS; the NGA GEOnet Names Server), a stable way to fetch **one record by its id** that the pipeline's fetcher can use without a login, a key or a browser, and the licence text. Record in the Execution record: the URL form, the response format, the fields holding the name and the coordinates, the licence, and one fetched example each. **If a database offers no such fetch** (only a bulk download of hundreds of MB, or a form), try its bulk file only if it is under 50 MB per needed country or theme; otherwise mark that database unusable. **If neither is usable, stop and tell the user**: Earth then falls back to quoted-sentence positions alone (spec §6.2).
- [ ] **Step 2: Write the failing tests** with two saved real responses as fixtures in `pipeline/fixtures/`:

```ts
expect(parseNamesRecord('gnis', gnisFixture)).toMatchObject({ name: <the fixture's name>, latDeg: <its latitude>, lonDegE: <its longitude as 0–360 east> });
expect(parseNamesRecord('gns', gnsFixture)).toMatchObject({ … });
expect(parseNamesRecord('gnis', '<html>not a record</html>')).toBeNull();
it('fails an Earth landmark whose record name differs from the landmark name', …)   // verifyLandmarks: "earth/<name>: record <id> is named <other>"
it('fails a names-database record on a host outside POSITION_HOSTS', …)
it('never accepts a POSITION_HOSTS-only host for a quoted sentence', …)              // nga.mil as a quote source -> not on an official host
```
(Expected numbers come from the fixtures themselves, read at test time or copied from the fetched record, never from memory.)
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** the fetch URL, the parser and the checks; the landmark's stored name must equal the record's name, or the record must list it as a variant name (then the card shows the landmark name and the position `text` says which record name it came from).
- [ ] **Step 5: Research Earth landmarks, with a log.** From NASA (Earth Observatory, SVS, science.nasa.gov), USGS and ESA pages: places with a sentence worth showing. For each, find its record in GNIS (United States) or GNS (elsewhere) and store the record id; where no record exists, use a quoted position if an official sentence states one; otherwise drop it. Each landmark has a plain `type` (for example "Mountain range", "Desert", "Reef"). Rank best known first. Log what was searched, found and dropped.
- [ ] **Step 6: Build and count.** `npm run data` → no errors. Count Earth's landmarks. **Fewer than 8: stop and report to the user.**
- [ ] **Step 7: Earth's placement guard.** Add Earth to `placement.test.ts` using two landmarks on land whose mirrored and half-turned longitudes fall on ocean; the measure is land against ocean on the colour map (for example blue-channel share), tuned by running the test. Record the choice.
- [ ] **Step 8: Write decision note 0010** (ADR style, like `0009-peer-reviewed-papers-for-estimates.md`): the user's decision of 2026-11-15, what the NGA may be used for (positions only), what it may not (quoted sentences), how records are checked, and the fallback. Write the data-source note. Update the README.
- [ ] **Step 9:** `npm run data:offline`, `npm test`, `npm run typecheck` → pass. **Commit** `feat(data): Earth landmarks with positions from GNIS and the GEOnet Names Server`.

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

- [ ] **Step 1: Write the failing tests**

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
- [ ] **Step 2: Run** `npx vitest run src/state src/ui/hotkeys.test.ts` → new tests FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `feat(explore): Surface and Interior tabs, feature selection and list state, URL and keys`.

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
- [ ] **Step 1: Write the failing tests**

```ts
it('enters on the sunlit side, 35 degrees off the Sun', () => { expect(exploreEntryAzimuth('mars', 'sun', [1, 0, 0], [0, 0, 0], 0)).toBeCloseTo(Math.PI + (35 * Math.PI) / 180); });
it('keeps the entry direction for the Sun itself', () => { expect(exploreEntryAzimuth('sun', 'sun', [0, 0, 0], [0, 0, 0], 1.2)).toBe(1.2); });
it('puts the camera over the feature', () => { expect(featureView([0, 1, 0])).toEqual({ azimuthRad: Math.PI / 2, elevationRad: 0 }); });
it('views a polar feature from 70 degrees, with a finite azimuth', () => { const v = featureView([0, 0, 1]); expect(v.elevationRad).toBeCloseTo(FEATURE_MAX_ELEVATION_RAD); expect(Number.isFinite(v.azimuthRad)).toBe(true); });
it('turns the short way round', () => { expect(turnStep({ azimuthRad: 3.0, elevationRad: 0 }, { azimuthRad: -3.0, elevationRad: 0 }, 0.5).azimuthRad).toBeCloseTo(Math.PI, 1); });  // through ±π, not through 0
it('ends exactly on the target', () => { expect(turnStep(a, b, 1)).toEqual(b); });
```
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the three functions, then in `CameraSystem.tsx`:
  - On Explore entry set `azimuthRad: exploreEntryAzimuth(…)` in the same `setView` call that sets the distance and tilt; compute `r.explore.up` from the **new** azimuth.
  - Keep a `turn: { from, to, startedAt, seq } | null` in the Explore record. When `featureSeq` differs from the last seen and a feature is selected, start a turn to `featureView(apply(orientation, surfaceDirection(lat, lon)))`. Each frame apply `turnStep` through `orbit.setView`; distance is untouched. Under reduced motion apply the target at once. **Any rotate or zoom input cancels the turn** (the user's input is applied that frame). Leaving Explore or changing tab cancels it.
- [ ] **Step 4: Add a unit-level test for cancel** in `explore.test.ts` if the turn logic is extracted into a pure reducer (`advanceTurn(turn, nowSeconds, hasInput, reducedMotion)` returning the next turn and view); extract it so it can be tested: with input → `turn: null` and no view change; reduced motion → target at once; `t ≥ 1` → `turn: null` at the target.
- [ ] **Step 5: Run** `npx vitest run src/camera` → PASS; `npm run typecheck` → clean. Run `npx playwright test e2e/explore.spec.ts` → all pass (the "scene matches the frame before Explore" test must still pass: the saved pose is restored on leave regardless of the entry azimuth).
- [ ] **Step 6: Commit** `feat(camera): Explore opens on the sunlit side; the view turns to a selected feature`.

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

- [ ] **Step 1: Write the failing tests** (`ExploreOverlay.test.tsx`)

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
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/ui/explore src/state` → PASS.
- [ ] **Step 5: Update the end-to-end tests** that name the old switch: every use of the radio "Whole" becomes "Surface" in the "Explore section" group; tests that click "Exploded" or "Half-section" first click "Interior" unless they arrive by URL or key. Add: `it('three tabs would fit on a phone')` in `layout.spec.ts` — at 390x844 the "Explore section" group is on one row and narrower than 60 % of the viewport (leaving room for a third tab of the same width). Run `npx playwright test e2e/explore.spec.ts e2e/layout.spec.ts` → pass.
- [ ] **Step 6: Screenshot check.** With the dev server, shoot `/?jd=2461317.5&pause=1&target=venus&explore=1&quality=high&fx=1` and the same for Mars and Jupiter at 1280x720 and 390x844. Look at each: tabs centred, sub-switch reads as secondary, notes do not collide with the title. Fix and repeat.
- [ ] **Step 7: Commit** `feat(explore): Surface and Interior tabs in the overlay; Venus shows its radar map on Surface`.

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

- [ ] **Step 1: Write the failing tests**

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
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/scene/surface` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Screenshot loop.** Dev server; shoot Mars, the Moon, Mercury, Venus and Earth on Surface at 1280x720 from the opening view, and each again after an orbit to another side (a Playwright drag), plus Mars at 390x844. For every landmark dot visible in a shot, compare it with the feature in the image: **the dot sits on the feature**. Check the look against `Assets/m2b4a/mockup-2-pin-styles.png`: names off the globe, thin lines, small glowing dots, nothing on top of the tabs or the strip. Fix and repeat until it looks right. A dot that is off its feature is a bug in the data path or the maths, not something to nudge.
- [ ] **Step 6: Commit** `feat(explore): landmark pins on the globe with names and leader lines`.

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

- [ ] **Step 1: Write the failing tests**

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
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; switch Task 7's feature lookup to `featureEntry`. **Step 4: Run** `npx vitest run src/ui src/camera` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Screenshot loop.** Mars with Olympus Mons selected (`…&explore=1&feature=olympus-mons`), the Moon with Tycho selected, Earth with a landmark selected, Mars with the list open and "pl" typed, at 1280x720; Mars card and list at 390x844. Check: the card matches the layer card's look; the list does not touch the strip or the title; names keep clear of both. Fix and repeat.
- [ ] **Step 6: Commit** `feat(explore): feature card, All features list and search`.

---

### Task 11: End-to-end tests, golden views and documentation

**Files:**
- Create: `e2e/features.spec.ts`
- Modify: `e2e/golden.spec.ts`, `e2e/layout.spec.ts`, `README.md`, `docs/SETUP.md` (only if a command changed), vault: `Architecture/ui.md`, `scene.md`, `state.md`, `camera.md`, `core.md`, `pipeline.md`, `Data Sources/USGS Gazetteer of Planetary Nomenclature.md`, `Changelog.md`, `Home.md`, `Start here.md`, `Plans/2026-10-05-m2a1-carry-over.md`, this plan's Execution record, the spec's "Amended while building", the session note
- Add: reviewed images in `Space_visualizer/Assets/m2b4a/`

- [ ] **Step 1: Write `e2e/features.spec.ts`** (each test waits for the canvas first, as the existing Explore tests do):
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
- [ ] **Step 2: Layout.** In `layout.spec.ts`, at the five sizes, on Mars Surface with a card open and the list open: the tabs, title, card, list, strip and ✕ do not intersect each other, and no visible pin name intersects any of them.
- [ ] **Step 3: Golden views** in `golden.spec.ts` (`quality=high&fx=1`, reduced motion): `8-mars-surface`, `8b-moon-surface-card` (Tycho selected), `8c-earth-surface`, `8d-venus-surface-radar`, `8e-mars-list` (list open), `8f-phone-mars-surface`. The existing `7*` views are re-shot (the entry direction changed).
- [ ] **Step 4: Run the full suite once.** `npm test`, `npm run typecheck`, then `npx playwright test` (about 8 to 10 minutes; one run at a time; if the runner does not exit after its summary, stop that process). Record the counts.
- [ ] **Step 5: Review every golden by eye** and copy the reviewed images to `Assets/m2b4a/` (and the re-shot `7*` images to `Assets/m2b3/`).
- [ ] **Step 6: Documentation.** Update each note listed above for what this section changed (tabs and keys in `ui.md`; pins in `scene.md`; the store in `state.md`; entry direction and the turn in `camera.md`; `surfacePoint`, `featureId` and the schema in `core.md`; landmarks, names databases and the guards in `pipeline.md`; the Mercury fix in the Gazetteer note and the Changelog). Copy every ruling and deferred minor finding from the progress ledger into the Execution record below and the carry-over note. Mark the carry-over's Venus-mirror item done. README: the Surface tab, pins, the list and the new URL parameters.
- [ ] **Step 7: Commit** `test,docs: feature pins end to end, golden views and the vault`.

---

## Execution record
(To be filled while building: commits per task, rulings with their cost if wrong, the Mercury duplicate ruling, the placement guard features and measured contrasts, the landmark research log per body, the names-database research, tuned values, deferred minor findings.)
