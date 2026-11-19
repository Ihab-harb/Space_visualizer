---
title: Decision register
tags: [handbook, decisions]
date: 2026-11-19
---

# Decision register

Back to [[Handbook]] · Rules: [[Rules]] · Sources: [[Sources register]]

Every decision the project rests on, with **who made it**, **why**, and where the full record is. The full records stay where they were written (decision notes, specs, plan Execution records); this note indexes them and gives the reason in a line or two.

## How decisions are made here
- **The user's decisions** are taken in a design talk, one question at a time, usually by picking from options or mockups. They are quoted in the user's own words.
- **"My calls"** are proposals the builder makes in a spec for the user to check. The user approves the spec as a whole; any call can still be reversed.
- **Rulings** are choices made on the user's behalf while building, when a plan is silent or wrong. Each is written with **what it costs if wrong**, so it can be reversed cheaply.
- **Decision notes (ADRs)** in `Decisions/` hold choices that are hard to reverse.

Known gap: the per-task rulings of M2a.1 and M2a.2 were lost when their scratch ledgers were deleted before being copied. Their outcomes survive in [[Changelog]], [[2026-10-05-m2a1-carry-over]], [[0007-tone-mapping-and-exposure]] and [[render]], and their planning-time scope rulings are below.

---

## 1. Product direction (the user)

| Decision | When | Why | Record |
|---|---|---|---|
| A 3D, time-accurate solar system in the browser, growing later to stars and galaxies | 2026-10-04 | The project's purpose | [[2026-10-04-solar-system-visualizer-design]] §1 |
| **Accuracy, information and visuals carry equal weight** | 2026-10-04 | None may be traded for another | Design spec §1 |
| Every fact from an official source, cited in the app | 2026-10-04 | Trust and checkability | Design spec §1 |
| Visual bar: cinematic, at the level of sael.net; **Realistic** and **Exhibit** styles; adaptive quality | 2026-10-04, after M1 | M1's plain spheres fell far short; graphics are a first-class deliverable | [[2026-10-04-m2-cinematic-and-rich-bodies-design]] §1 |
| More detail per body before more bodies (M2b before M3) | 2026-10-04 | Depth before breadth | M2 spec §1 |
| All four detail areas: interior, atmosphere, missions, features and fields | 2026-10-04 | Full picture of each body | M2 spec §1 |
| Milestones M1 → M2a → M2b → M2c → M3 … M7 | 2026-10-04 | See the milestone table | M2 spec §3 |
| Work in sections, each with its own branch and PR; completed sections merged into `main` with merge commits | 2026-10 and 2026-11-15 | Reviewable, revertible pieces | `Start here.md` §3 |
| Subagent-driven builds; per-task reviews on Sonnet, final reviews on Opus | 2026-10 | The user declined an Opus per-task reviewer once | `Start here.md` §4 |
| Cloud sessions shelved | 2026-11-15 | The user's choice | [[Cloud sessions]] |

## 2. Technology and architecture

| Decision | Why | Rejected | Record |
|---|---|---|---|
| **Vite, TypeScript strict, React, Zustand, Zod, Vitest, Testing Library, Playwright** | A typed, fast, well-supported stack; Zod validates data at both ends | — | Design spec §2 |
| **React Three Fiber + drei over three.js**; raw three.js for hot paths | One component and state model for a heavy interface over a 3D scene | Plain three.js (glue code), CesiumJS (Earth-centric), Babylon.js (smaller ecosystem) | [[0002-react-three-fiber]] |
| **Pure `src/core`** with no React or three.js | Unit-testable maths, reusable by a worker or backend | — | Design spec §3.1 |
| **Floating origin and logarithmic depth;** float64 positions in core | float32 jitters at AU distances; a normal depth buffer cannot span 1 m to 10¹³ km | — | [[0003-floating-origin-and-log-depth]] |
| **Nested regions** with a region manager, only the Solar System built | The growth path to galaxies without a rewrite | — | Design spec §3.3 |
| **WebGL2 with custom `ShaderMaterial`s,** object-space lighting computed in float64 on the CPU | Browser reach; testable under SwiftShader in CI; full control of precision | WebGPU/TSL (not in the CI browser), patched stock materials | [[0005-webgl2-custom-shaders]] |
| **WebP texture tiers; KTX2 deferred to M7** | Small commits, no WASM encoder; HD tiers stay local | KTX2 now | [[0006-webp-tiers-ktx2-deferred]] |
| **AgX tone mapping; scene-driven exposure** (from the Sun's computed visibility, not metering) | AgX keeps the maps' colours and faint light; scene-driven exposure is deterministic and does not pump | ACES (crushes the low end, oversaturates), luminance metering | [[0007-tone-mapping-and-exposure]] |
| **Analytic eclipse and ring shadows** in shaders, geometry in core | Shadow maps cannot span solar-system distances | Shadow maps | M2 spec §5 |
| **One details file per body, loaded on demand** | Fast start; the user may revisit | One big file | M2b.1 spec §2 |
| **Pins as DOM labels with leader lines,** reusing Explore's label layout | Sharp text, one design for both tabs, no fight with bloom and depth of field | 3D sprites; names baked into textures | M2b.4a spec §3 |
| **Committed generated data** (`public/data`, 1k/2k textures) | Every data change is a reviewable diff | Generating at deploy time | Design spec §4.3 |

## 3. Data and sources

| Decision | Who | Why | Record |
|---|---|---|---|
| Planet orbits from **JPL Approximate Positions of the Planets** (Table 1, 1800–2050; Table 2 as fallback) | Spec | JPL's published model; small and offline | Design spec §4.1; [[JPL Approximate Positions of the Planets]] |
| **Measure accuracy against JPL Horizons** and show the measured figure | Spec, from planning | JPL's Neptune figure was exceeded up to 7× | [[0004-measured-accuracy]] |
| Rotation and shape from **NAIF PCK00011** (IAU WGCCRE 2015) | Spec | The machine-readable IAU model | [[NAIF PCK00011]] |
| Physical facts from **NSSDCA fact sheets** | Spec | NASA's archive of record; one parseable table | [[NSSDCA Planetary Fact Sheet]] |
| Time from **IERS leap seconds** and **NASA ΔT polynomials** | Spec | The official time-scale tables | [[IERS leap seconds]], [[NASA Delta T polynomials]] |
| Imagery from **NASA Visible Earth, NASA SVS, USGS Astrogeology, STScI OPAL** | Spec | Official global maps | M2 spec §6; [[Sources register]] |
| Interior layers, missions and discovery **curated and quoted**, checked against the live page | The user | Values that are not in a table still need proof | M2b.1 spec §2 |
| Named features: the **largest ~200 approved Gazetteer features** per body | The user | Enough to explore; bounded file size | M2b.1 spec §2 |
| **Moon from a Chebyshev table of Horizons vectors** (16-day segments, degree 12, ≤ 1 km), JPL mean elements outside 1800–2051; Earth moved off the barycentre with NAIF GM DE440 | The user approved the spec | Mean elements were far off; run-time Horizons needs a network | [[0008-moon-chebyshev-table]] |
| **Peer-reviewed papers for interior estimates** where no official number exists | The user, 2026-10-30 | Venus and the giants otherwise show no sizes | [[0009-peer-reviewed-papers-for-estimates]] |
| **Earth landmark positions from official names databases** (GNIS first) | The user, 2026-11-15: option B | The Gazetteer has no Earth; NASA pages rarely state positions | [[0010-names-databases-for-earth-positions]] |
| **Other official names databases** (NOAA NCEI volcanoes, GEBCO undersea names, NRCan, LINZ) | The user: "it didn't work use other official sources that have similar data"; then "use the new sources" | NGA GNS was unreachable | 0010 second decision |
| **Australia's Composite Gazetteer** under Geoscience Australia's site licence | The user: "keep australia" (the builder's reading recorded as a reading) | The dataset states no licence of its own | 0010 third decision |
| **Common names on Earth cards, database name beside the position** | The user: "have both versions of the names" | Familiar and traceable | [[2026-11-15-m2b4a-feature-pins]], "Both names" |

## 4. Interface and behaviour (the user's choices)

| Decision | Section | Record |
|---|---|---|
| Header with headline, stat chips and a narrative; glass control panel; pill labels; facts drawer; Tour | M2a.3 | M2 spec §4 |
| Explore mode on the selected body; **Exploded** and **Half-section** views; ranked log-scale composition bars; centre-stage layout | M2b.3 | [[2026-10-30-m2b3-explore-interior-design]] §2 |
| M2b.4 split in two: **pins first** (M2b.4a), then **fields and aurora** (M2b.4b) | M2b.4 | [[2026-11-15-m2b4a-feature-pins-design]] §2 |
| **Landmarks first, full atlas behind** (option C) | M2b.4a | Same, §2 and §3 |
| Earth gets **curated landmarks only** for now ("we might later add a full list for earth") | M2b.4a | Same, §2 |
| **Surface and Interior tabs** in Explore (option A); **names beside the globe with leader lines** (option A) | M2b.4a | Same, §2 |
| Two sizes on a card: **explain the difference** | M2b.4a follow-up | The user, 2026-11-16 |
| Rotating to the needed side: **drag already does it**; no special opening view | M2b.4a follow-up | The user: "we should be able to rotate the planet to get the side we need" |
| Night-side features: **light the area when selected**, and **label it** illustrative | M2b.4a follow-up | The user, 2026-11-16 |
| List clutter and Tab reaching pins: **later** | M2b.4a follow-up | The user: "we will hande the UI clutter at a later point"; "will be handled later" |
| Weak landmark sentences: **fix them** | M2b.4a follow-up | The user: "fix the weak scentences" |

## 5. Planning-time scope rulings (deviations from a spec, decided when the plan was written)

**M2a.1** ([[2026-10-04-m2a1-imagery-and-shading]]):
- One Blue Marble month (July 2004), not one per date: NASA's monthly record ids were irregular. More months are a data-only addition later.
- The latest OPAL map per giant, not the year nearest the date: avoids about 4× the download.
- Moon imagery deferred to M2b (no Moon body yet). Venus radar view deferred to M2a.2 (no toggle yet).
- WebP, not KTX2 (decision 0006).
- Ring structure from NSSDCA ring fact sheets, not PDS profiles (heavy toolchain); ring colour tint illustrative.
- Mercury colour from the MDIS 3-colour mosaic, desaturated 80 % and labelled (the monochrome basemap is 4.2 GB; the colour mosaic is stretched).
- Sun limb darkening illustrative, uncited (coefficients could not be verified).

**M2a.2** ([[2026-10-05-m2a2-cinematic-effects-and-quality]]):
- Interface redesign and Tour moved to M2a.3 (one PR per section).
- Scene-driven exposure, not metering (space frames are mostly black; metering pumps).
- Camera effects off keeps a Neutral tone mapper (with none, HDR clips to white).
- Own float64 Sun occlusion for the flare, not the library's raycast (which counts the Sun itself as a hit).
- God rays from a proxy sphere (the effect re-parents its light source).
- Streaks before exposure and tone mapping (they need HDR values).
- Medium pixel ratio `min(devicePixelRatio, 1.25)` (never above native).
- Only HD tiers that exist are requested (a build-time list).

## 6. Rulings made while building

Each line: the ruling, then its reason or cost if wrong. The full text is in each plan's Execution record.

### M2a.3 interface and Tour ([[2026-10-07-m2a3-interface-and-tour]])
- The 3 s Auto-quality warm-up stays; the plan's test trace was corrected. Cost: Auto may step down early on a genuinely slow start, as intended.
- God-ray guard at 77.5 grey levels (midway), since rays add only ~5 of ~80 levels. Cost: a coarse guard.
- Auto-repeat keys never stop the Tour; Ctrl/Cmd/Alt chords do. Cost: Ctrl+T ends the Tour.
- The header subtitle's distance and the overview's counts carry no citation (app state, or a cited chip beside them). Cost: a stricter reading wants one.
- Earth's label hidden in the overview (the Sun wins the cluster). Cost: home body unlabelled on landing.
- Pill-label distances uncited (the header shows the cited value); Esc returns to Orbit; header and drawer throttled to ~4 Hz; `?rate=` parameter kept; a Tour from Follow ends in Orbit. Each with a small cost listed in the record.

### M2b.1 body details ([[2026-10-10-m2b1-body-details]])
- Consecutive interior layers must touch, within max(40 km, 0.5 % of radius). Cost: a real gap fails until a range widens; a missing very thin layer is not caught.
- Superscripts render as Unicode (10⁶ not 106); subscripts stay ASCII (CO2).
- Official hosts list and a 6-word minimum for quotes.
- Interiors only for the Sun, Mercury, Earth and Mars (no official numbers for the others, until decision 0009).
- A number right after a "(km)" table label counts as kilometres; each bound may state its own form.
- Mission dates follow the cited page's convention (Mariner 4: July 14 EDT, July 15 UT).
- R is the NSSDCA volumetric mean radius; Gazetteer values rounded to 1e-4° and 1e-3 km.
- Discovery method kept but not shown (no quote states it). Apollo 8 moved from Earth to the Moon.

### M2b.2 the Moon ([[2026-10-29-m2b2-moon]])
- No blending at the table edge (it would invent positions); the jump is documented.
- The table runs 4 days past 2051-01-01 (no segment length divides the range); real Horizons data covers it.
- Earth's centre check bound is JPL Table 1's nominal, not 50 km (a plan error).
- Mean elements as fallback, with the measured error shown (up to ~175° far out); the Moon reads **out of range** outside the table. Open for the user: extend the table.
- Mean elements parsed from JPL's live page, not hand-typed.
- Moon hidden only when Readable-scale inflation causes the overlap.
- "The Moon" takes the article; other moons do not.
- No Moon discovery entry (no official sentence; the citation rule outranks the spec).
- CH4 and NH3 formulas accepted (standard chemistry, not data).
- Eclipse tint for any body shadowed by a body with an atmosphere; revisit per planet in M3.
- Phase chip on mean elements cited to JPL elements; the red status shows the poor accuracy.

### M2b.3 Explore interior ([[2026-10-30-m2b3-explore-interior]])
- Per-layer transforms published once per frame in `frame.explore` (one source of truth; labels lag one frame).
- An all-illustrative interior is allowed (no numbers, clearly tagged).
- Explore button has no `aria-pressed` (an action, not a toggle).
- Journal names stored as canonical titles with aliases.
- Shah et al. 2022's "core size" recorded as the Venus core radius (documented exception: a diameter that large is impossible).
- Explore framing ignores `dist`; the half-section face is yawed 45°.
- Interior wording table in the UI for "about" and "(global average)" (debt: move into the data).
- Bounded negative in the saturation push (a zero clamp brings back the pastel look). Open: check on a real GPU.
- Fix wave: depth ruler built, soft bands for dilute cores, loading and error states, ruler hidden on phones, map gap fills in Explore only, 200 ms chrome fade.

### M2b.4a feature pins ([[2026-11-15-m2b4a-feature-pins]])
- Duplicate feature **ids** fail the build, not duplicate names; Mercury's doubled rows deduped keeping the more precise row.
- Placement guards rebuilt on **physical priors with feature-sized discs** after the first set was fitted by scanning the map.
- A type-meaning quote may join two table rows to reach 6 words.
- Stray spaces before punctuation stay in data; display tidies them.
- **NASA image-centre coordinates are not positions.**
- GNIS fetched by state file (no single-record fetch exists).
- A pin name that does not fit its own side shows as a dot only; the selected pin is exempt.
- Night-side pins stay bright; the turn does not chase the Sun (later: the feature light, at the user's request).
- An Earth landmark's type is the record's class, cited to the database (GNIS says "Valley" for the Grand Canyon).
- `schemaVersion` stays 1 although three fields became required (app and data ship together).
- Earth positions shown with hemisphere letters, record digits kept (F5).
- Task 12: a GEBCO name is specific + generic terms; NOAA "Unknown" morphology is no class; NRCan type from its code list; national scope by the record's territory field; each record on its own host; GEBCO cited to gebco.net.
- Task 12 review: the country check fails closed when a record has no territory.
- Follow-ups: the size note with a 0.5 % threshold and a general wording (no source says why each pair differs); the feature light tuned to 5°–30°, level 0.75, shaded by relief; ids follow the shown name, so ten Earth ids changed.
- Task 13: "inside Australia" is the record's state or mainland territory authority; type is `feature` in sentence case; the cited page is the catalogue record; four weak sentences kept with reasons (Gula Mons, Sapas Mons, Mare Imbrium, Meridiani Planum); Elysium Planitia's new sentence accepted though it starts "Just north of the divide"; Nathair Facula dropped as a landmark but kept as a placement guard.

## 7. Open decisions (waiting for the user)
Kept current in the latest session note, [[2026-11-15-session-m2b4-pins]] ("Open for the user"). At the time of writing:
- Push the latest commits to PR #9, and merge it.
- Drop or keep the six still-weak landmark sentences (Elysium Planitia, Apollodorus, Gula Mons, Sapas Mons, Mare Imbrium, Meridiani Planum).
- Fix the network data build broken by NSSDCA's chronology page (Venera 7 and 13 quotes).
- Extend the Moon's Horizons table beyond 1800–2051 (from M2b.2).
- Check the interior colours and the pins on a real GPU (from M2b.3 and M2b.4a).
