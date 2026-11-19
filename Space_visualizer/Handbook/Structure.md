---
title: Structure
tags: [handbook, architecture]
date: 2026-11-19
---

# Structure

Back to [[Handbook]] · Detail per module: [[Overview]], [[core]], [[state]], [[scene]], [[render]], [[camera]], [[ui]], [[pipeline]]

How the project is laid out: the repository, the flow of data, the modules and what each owns, and the vault.

## 1. The two halves
The project has two programs that meet at committed files:

1. **The pipeline** (`pipeline/`, run with Node and `tsx`) fetches official sources, checks every value, and writes JSON and textures. It runs on the developer's machine, never in the browser.
2. **The app** (`src/`, built with Vite) loads those files and draws the solar system. It never calls an outside service at run time.

```
official sources ──fetch──▶ pipeline/raw/ (cache, git-ignored)
                              │ parse · normalise · check quotes · validate (Zod)
                              ▼
                  public/data/*.json   public/textures/**   (committed; reviewed as diffs)
                              │ loadCatalog · detailsStore (Zod again)
                              ▼
   timeStore ─▶ core ephemerides (float64 km) ─▶ scene (floating origin) ─▶ render (effects) ─▶ screen
                         ▲                         ▲
                     camera controllers        ui (header, drawer, Explore, pins)
```

**Why this split:** the app works offline and loads fast; every number it shows was checked once, at build time, and any change to a number is a visible diff in review. The pipeline can be strict (stop on any problem) without ever breaking a user's page.

## 2. Repository layout

| Path | What it holds | Notes |
|---|---|---|
| `src/core/` | Pure TypeScript: maths, time scales, ephemerides, rotation, catalogue and details schemas, interior geometry, eclipse geometry, regions | No React, three.js or stores (rule C2) |
| `src/state/` | Zustand stores: time, selection, view, render quality, tour, UI, Explore, details loading, sky, URL parameters, feature light | Each store owns one concern |
| `src/scene/` | React Three Fiber components: bodies, orbit lines, labels, materials and shaders, sky, interior cutaway, surface pins | Floating origin: the camera stays at (0,0,0) |
| `src/render/` | Quality presets and the Auto controller, the post-processing stack, exposure, depth of field | Pure models plus the React pieces that apply them |
| `src/camera/` | Camera rig, Orbit and Follow controllers, transitions, Tour, Explore framing and turn-to-feature | Pure maths where possible |
| `src/ui/` | Header, control panel, facts drawer, bottom bar, hotkeys, citations, Explore overlay, feature card and list | `hotkeys.ts` is the single owner of keys |
| `src/styles/` | Design tokens and CSS | Dark glass, Inter and JetBrains Mono |
| `src/test/` | Test setup and real-data helpers | Tests use committed data |
| `pipeline/sources/` | One fetcher or parser per source: JPL, NAIF, NSSDCA, NASA Science, Gazetteer, names databases, quoted references | `registry.ts` holds the `SourceSpec`s |
| `pipeline/build/` | Assembles `bodies.json`, the details files and `sources.json`; validation | Writes nothing if anything fails |
| `pipeline/lib/` | Cached fetching, HTML to text, zip and dBASE readers, Chebyshev fitting | No new dependencies for these |
| `pipeline/reference/` | Curated, quoted data: `interiors.json`, `missions.json`, `landmarks.json`; Horizons reference vectors; the curation rules (`README.md`) | The only hand-written data |
| `pipeline/textures/` | Download, reproject, derive normal maps, masks and ring profiles, tier to WebP, validate | Large downloads, local machine only |
| `pipeline/fixtures/` | Real recorded responses used by tests | Never hand-made |
| `pipeline/raw/` | The download cache | Git-ignored |
| `public/data/` | `sources.json`, `regions.json`, `solar-system/bodies.json`, `details/<body>.json`, `ephemeris/moon.json` | Generated, committed |
| `public/textures/` | 1k and 2k WebP tiers per body, `imagery.json` | 4k and 8k local only |
| `e2e/` | Playwright tests: app, details, Explore, features, golden views, interface, layout, quality | SwiftShader WebGL2 |
| `e2e-perf/` | Frame-time probe on a real GPU (`npm run perf`) | Local machine only |
| `scripts/` | Small tools: `sources-register.mjs` (writes [[Sources register]]), the shelved cloud start script | |
| `docs/SETUP.md` | Requirements, running, testing, the pipeline, troubleshooting | For a developer setting up |
| `Space_visualizer/` | The Obsidian vault: all project documentation | See §5 |

## 3. The data model
- **Every fact is a sourced value:** `{ value, unit?, uncertainty?, sourceId }`. A `Source` is `{ id, title, publisher, url, retrievedAt, license }`. The app shows a numbered citation beside each value and lists the sources.
- **`bodies.json`:** per body its category, parent, NAIF id, facts, orbit model (with its valid range and measured accuracy), rotation, shape, description, imagery (texture tiers with their sources and derivations, "illustrative" flags), render settings.
- **Details files (one per body, loaded on demand):** interior layers (bounds with their form, estimate and illustrative flags, composition, state), atmosphere composition, magnetic field, missions and discovery, named features (up to 200 per body) and curated landmarks, type meanings.
- **Orbit models:** `planet-approx` (JPL elements), `satellite-mean` (JPL mean elements), `table` (the Moon's Chebyshev table). Each declares its valid range and accuracy.
- **Frames and units:** heliocentric ecliptic J2000, km, float64; angles in degrees in data, radians in core; time as a Julian Date in TDB.

## 4. How a frame is drawn
1. `FrameDriver` (priority −2) advances time and computes every body's position and orientation in float64.
2. `CameraSystem` (−1) computes the camera pose from the active controller.
3. `BodyMesh` (−0.5) places each body at its position minus the camera's.
4. Labels, orbit lines, pins and lights (0) read those positions.
5. The effects stack renders: bloom, god rays and flare, streaks, exposure, depth of field, AgX tone mapping, then chromatic aberration, vignette and grain.

Why the fixed order: labels and pins must read positions written earlier in the same frame, or they lag one frame behind (see [[Overview]]).

## 5. The vault (`Space_visualizer/`)

| Folder or note | What it holds | When it is written |
|---|---|---|
| [[Home]] | The index of everything | Each change of state |
| [[Start here]] | Goals, working agreements, process, environment, current state | Read first in every session |
| [[Handbook]] | This handbook: method, structure, quality, rules, sources, decisions | Kept current with the rules |
| `Specs/` | One design spec per section, approved by the user, with "Amended while building" notes | Before a build |
| `Plans/` | One plan per section: tasks, tests, commands; the **Execution record** with rulings, reviews and numbers | Before and during a build |
| `Decisions/` | ADR-style decision notes 0002–0010 | When a hard-to-reverse choice is made |
| `Architecture/` | One note per module | With code changes |
| `Data Sources/` | One note per source family: publisher, URL, files, what it feeds, caveats, licence | When a source is added or changed |
| `Sessions/` | One note per chat session: requests in the user's words, decisions, state, open items | During and at the end of each session |
| [[Changelog]] | Dated history | Each piece of work |
| [[2026-10-05-m2a1-carry-over]] | Every deferred item, by the section it came from | After each review |
| `Assets/` | Golden screenshots and mockups per section | With visual work |
| [[Cloud sessions]] and the cloud plans | Shelved since 2026-11-15 | Reference only |
