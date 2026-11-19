---
title: Rules
tags: [handbook, rules]
date: 2026-11-19
---

# Rules

Back to [[Handbook]] · Sources: [[Sources register]] · Decisions: [[Decision register]]

Every rule the project follows, in one place. Each rule says **where it is stated** (the note or file that binds it) and **why** it exists. If a rule here and its source note ever disagree, the source note wins and this note is corrected.

Most rules are enforced by code: the build or a test fails when they are broken. Those are marked **(enforced)** with the check that does it. The rest are working agreements.

---

## 1. Sources

| # | Rule | Where stated | Why |
|---|---|---|---|
| S1 | **Official sources only.** Every value shown comes from a publisher of record: NASA (including JPL, NSSDCA, SVS, Earth Observatory), USGS, ESA, NAIF, IERS, STScI, IAU (through the USGS Gazetteer). | Design spec §1 and §4.2 ([[2026-10-04-solar-system-visualizer-design]]); `CLAUDE.md` | Accuracy is one of three equal goals. A value is only as good as its publisher, and official publishers are traceable, stable and correct more often than anyone who copies them. |
| S2 | **No Wikipedia, Wikidata, GeoNames.org, OpenStreetMap, Natural Earth, blogs or aggregators**, even where they copy official data. | `CLAUDE.md`; [[0010-names-databases-for-earth-positions]] | A copy can drift from its original, and its edits are not reviewed by the publisher. Citing the original removes that doubt. |
| S3 | **Quoted sentences come only from official hosts:** nasa.gov, usgs.gov, esa.int, jaxa.jp, isro.gov.in, cnsa.gov.cn and their subdomains (`OFFICIAL_HOSTS`). **(enforced:** `checkSources` in `pipeline/sources/quotedReference.ts`**)** | `pipeline/reference/README.md` rule 1; M2b.1 Task 4 ruling 3 | A curated value is only checkable if its page is from an agency that stands behind it. The host list makes the check mechanical. |
| S4 | **Peer-reviewed papers are allowed only for interior layer sizes, and only where no official source gives a number.** DOI required, `https://doi.org/` URL, a journal from `TRUSTED_JOURNALS`, quote checked on the DOI page or an open copy (arXiv, PubMed Central, NASA ADS). Such a layer is marked **Estimate**. **(enforced:** `quotedReference.ts`**)** | [[0009-peer-reviewed-papers-for-estimates]] | NASA names the layers of Venus and the giants but gives no sizes. Showing nothing hid real science; any web source would break trust. Trusted journals plus a quote check plus an "Estimate" tag is the narrowest opening that works. |
| S5 | **No papers for landmark sentences.** **(enforced:** "papers are not allowed for landmarks"**)** | M2b.4a spec §11 call 12 | A landmark sentence is a general statement; NASA, USGS and ESA have one for every place worth showing. |
| S6 | **Earth landmark positions may come from official names databases,** and nothing else may come from them. Allowed: a government agency or intergovernmental body, fetchable with no key, login, cookie or browser, with terms that allow use with attribution. **(enforced:** the registry `NAMES_SOURCES` and `POSITION_HOSTS`; position-only hosts are never accepted for a quote**)** | [[0010-names-databases-for-earth-positions]] (three decisions) | The Gazetteer has no Earth entries, and NASA pages rarely state where a place is. A names database is the official register of where a named place is. |
| S7 | **A national names database is used only inside its own country,** checked on the record's own territory field (NRCan province code, LINZ land district, Geoscience Australia authority). A record with no territory fails. **(enforced:** `checkNamesPosition`**)** | 0010 second and third decisions; Task 12 review fix | A national agency speaks for its own territory only. Checking the record's own field, not its coordinates, avoids drawing borders ourselves. |
| S8 | **Each record is cited on its own database's host.** **(enforced)** | 0010 second decision | Stops one database's page being used to cite another's record. |
| S9 | **Every source is registered** with id, title, publisher, URL, licence and retrieval date. Source ids are unique. **(enforced:** Zod schema and `checkSources`**)** | Design spec §4.1; README "Files" | The app shows each source on screen; the licence must be known before anything is shown. |
| S10 | **Licences are recorded with the text and where it is stated.** When a dataset states none, that is written down with what was accepted instead. | 0010 second and third decisions | So a later reader can check the right to use each source without redoing the research. |
| S11 | **Image-centre coordinates are not positions.** A "Location: 3° S, 37° E" line under a picture is the picture's centre. | M2b.4a Task 5 ruling; 0010 | The centre of a photo is not the place. Using it would invent a position. |
| S12 | **If an official source does not state a value, the value is not recorded.** No estimate, no reasoning it out. | README rule 1 | A gap is honest; a guess wearing a citation is not. |

## 2. Values and citation

| # | Rule | Where stated | Why |
|---|---|---|---|
| V1 | **Every displayed value links to its source; the data build fails if any value lacks one.** **(enforced:** Zod schemas and `sourceId` resolution in `pipeline/`; UI tests on citations**)** | Design spec §1 success criteria, §4.1 | The information goal: a user can check every number. |
| V2 | **Every curated number keeps the exact sentence it came from,** and the build checks that sentence is still on the fetched page. **(enforced:** `quoteOnPage`, `checkQuote`**)** | M2b.1 spec §2; README rules 2 and 3 | Hand-curated values can be mistyped or outlive their page. The sentence makes each one checkable forever, and the check catches a page that changed. |
| V3 | **Quotes are at least 6 words, copied exactly.** Curly quotes, dashes, non-breaking spaces, entities and case may differ; nothing else. **(enforced)** | README rule 2 | A bare phrase is not evidence. Exact copy means no paraphrase can change the meaning. |
| V4 | **Every recorded number appears in its own quote,** in the stored unit (kilometres, percent, a day-level date). **(enforced:** number and date parsers in `quotedReference.ts`**)** | README rules 3–7 | Stops a number coming from memory beside a sentence that does not say it. |
| V5 | **Kilometres, not miles; radius, not diameter; no halving or converting by hand.** Unit conversion is done by the build from cited inputs only (depth to radius with the cited mean radius; percent with the cited mean radius). | README rules 4–6 | Each hand conversion is a chance for error that no check can catch. |
| V6 | **Never reword a quote.** Display may tidy spacing (`tidyQuote`); the stored text stays as the page has it. | M2b.4a Task 4 ruling; brief rules | The stored quote must match the page for the check to work. |
| V7 | **"Unknown" or missing source values are omitted,** never shown as `undefined`, `NaN` or an empty row. **(enforced:** `parseFactCell`, UI tests**)** | M1 plan Review Focus 4 | A blank is honest; a broken value looks like a bug or a fact. |
| V8 | **Positions keep the record's own digits.** The card adds degree signs and hemisphere letters; nothing is rounded. **(enforced:** `formatRecordPosition` tests**)** | M2b.4a fix wave ruling F5 | Rounding would put a different number beside the citation. |
| V9 | **Two sizes on one card are explained.** When a quoted sentence states a width more than 0.5 % from the Size row, a fixed line says they come from different sources. **(enforced:** `sizesDiffer` tests**)** | The user, 2026-11-16: "clarify the difference for the user" | Two different cited numbers side by side look like an error unless the card says why. |
| V10 | **A landmark may be shown under the name its quoted page uses,** with the database's own name shown beside the position (`recordName`). The build checks the record's name and that the shown name is on the quoted page. **(enforced)** | The user, 2026-11-16: "have both versions of the names" | Database spellings ("Fujisan") are correct but unfamiliar; both names keep the card friendly and traceable. |

## 3. Positions, time and accuracy

| # | Rule | Where stated | Why |
|---|---|---|---|
| P1 | **Positions are computed from official ephemeris data in float64 km,** heliocentric ecliptic J2000. **(enforced:** tests against committed Horizons vectors**)** | Design spec §3.2, §4.1; [[0003-floating-origin-and-log-depth]] | The accuracy goal, and precision across solar-system distances. |
| P2 | **Show measured accuracy,** not only the published figure. The pipeline measures every orbit model against committed JPL Horizons reference vectors and the drawer shows both. **(enforced:** `horizonsCheck`; tests allow 3× nominal, 10× for Neptune Table 1**)** | [[0004-measured-accuracy]] | JPL's published Neptune error was exceeded up to 7×. Users deserve the real figure. |
| P3 | **Outside a model's valid range, say so.** The status bar warns, bodies are marked approximate; the Moon on mean elements is "out of range". | Design spec §4.5; M2b.2 final review ruling | An extrapolated position must not look like a precise one. |
| P4 | **Never blend two models at a boundary.** The Moon jumps at its table edge rather than being smoothed. | M2b.2 Task 2 ruling | Blending would invent positions. |
| P5 | **Simulation time is a float64 Julian Date in TDB;** UTC via the IERS leap-second table, ΔT before 1972; TDB ≈ TT. | Design spec §4.4; M1 global constraints | One time scale end to end; the ephemerides are in TDB. |
| P6 | **No position is typed from memory or read off a map or picture.** Each Earth position is a fetched record's own, or numbers stated in a quoted sentence. **(enforced:** `parseStatedPosition`, record checks**)** | README Landmarks rule 2 | A position someone remembers or eyeballs cannot be cited. |
| P7 | **Stated positions may change notation only** (degrees-minutes to decimal, west to a sign), never be derived. | M2b.4a spec §11 call 18 | Notation is not a new fact; a derivation would be. |
| P8 | **Physical constants are exact published values** (AU = 149 597 870.7 km, IAU 2012 B2; c; J2000; the J2000 obliquity). | M1 global constraints | So every computation matches JPL's. |

## 4. Imagery and visuals

| # | Rule | Where stated | Why |
|---|---|---|---|
| I1 | **Realistic-mode imagery comes only from official products** (NASA, USGS, ESA, JPL, STScI), each a cited source. | M2 spec §2 | The visuals goal must not cost accuracy. |
| I2 | **Procedural and cinematic visuals are allowed and labelled "illustrative"** (Venus clouds, Sun granulation, band flow, exaggerated relief, eclipse tint, earthshine, interior colours, the feature light). | M2 spec §2; the user, 2026-11-16: "label it" | Cinematic looks are a goal; misleading the viewer is not allowed. The label keeps them apart. |
| I3 | **No data value is ever derived from an illustrative or stylized visual.** | M2 spec §2 | A picture that was tuned for looks cannot be a measurement. |
| I4 | **Exhibit mode surfaces are built from official elevation and colour data,** labelled "stylized". | M2 spec §2, §9 | Stylized, but still grounded. |
| I5 | **Maps must be placed right.** Placement guards check that a dark mare is dark, a bright facula bright and land is land at the true position, and that a mirrored or half-turned map would fail. Guards use **physical priors**, not values measured off the map. **(enforced:** `pipeline/textures/placement.test.ts`**)** | M2b.4a Task 2 ruling | A pin on the wrong spot is a wrong fact. A guard fitted by scanning the map would only freeze an error, not catch it. |
| I6 | **Texture budget 60 MB committed; 1k and 2k tiers committed, 4k and 8k local.** **(enforced:** texture validator**)** | [[0006-webp-tiers-ktx2-deferred]] | The app must stay small to clone and load; sharper tiers remain available locally. |
| I7 | **Screenshot-and-refine loop on every visual task:** render, look, fix, repeat. Never ship placeholder visuals without saying so. | `Start here.md` §1; memory note on the visual bar | Graphics are a first-class deliverable; code that compiles can still look wrong. |
| I8 | **No pixel-diff tests;** golden views are reviewed against a written look checklist. | M2 spec §7 | GPU output differs between machines; a pixel diff would fail for the wrong reasons. |

## 5. Code

| # | Rule | Where stated | Why |
|---|---|---|---|
| C1 | **TypeScript strict, ESM everywhere, Node ≥ 24.** **(enforced:** `tsconfig.json`, `npm run typecheck`**)** | M1 global constraints | Type errors caught before run time. |
| C2 | **`src/core` is pure:** no React, three.js, R3F, Zustand or imports from `src/state`, `scene`, `camera`, `ui`. Zod for schemas only. | Design spec §3.1; M1 global constraints | The maths is fully unit-testable and reusable by a worker or a backend later. |
| C3 | **Data is validated with Zod** in the pipeline and when the app loads it; a failure names the field path. | Design spec §2, §4.3, §8 | Bad data stops at the door with a readable reason. |
| C4 | **The pipeline writes nothing if anything fails.** If a source is unreachable, the previous committed data stays. **(enforced:** `pipeline/run.ts`**)** | Design spec §4.3, §8 | A half-written data set is worse than an old one. |
| C5 | **Raw downloads are cached** in `pipeline/raw/` (git-ignored), so `npm run data:offline` rebuilds everything with no network. A fetch that fails, times out (two minutes) or returns an empty page keeps the cached copy. **(enforced:** `fetchCached` tests**)** | Design spec §4.3; fix of 2026-11-19 | Reproducible builds; tests and reviews do not depend on websites being up; a passing server fault must never erase good data. |
| C6 | **Generated data is committed** (`public/data/`, 1k/2k textures), so a data change is a reviewable diff. | Design spec §4.3 | Every change to a number shows up in review. |
| C7 | **Shaders:** `ShaderMaterial` with three's log-depth chunks, object-space lighting, ASCII-only GLSL, NaN-safe; any shader compile error fails the end-to-end suite. | [[0005-webgl2-custom-shaders]]; M2a.1 and M2a.2 global constraints | Precision control and CI checks under SwiftShader. |
| C8 | **Dispose what you create:** every `ShaderMaterial` or geometry made with `useMemo` is disposed on change or unmount. | M2a.2 global constraints | GPU memory leaks are silent until a phone runs out. |
| C9 | **One owner per concern:** `src/ui/hotkeys.ts` owns keys; `renderStore` decides quality; `frame.explore` is the one source of the Explore geometry each frame. | [[Overview]]; M2b.3 ruling R2 | Two owners drift apart. |
| C10 | **Frame order is fixed** (`useFrame` priorities −2 time, −1 camera, −0.5 bodies, 0 labels). | [[Overview]] | Labels and lines read positions written earlier in the same frame. |
| C11 | **No new dependencies without a reason;** follow existing patterns. | Task briefs since M2b.1 | Fewer moving parts to maintain and audit. |
| C12 | **Hard-to-reverse choices get a decision note** (ADR) in `Decisions/`. | `Start here.md` §2 | So the reason survives the person who made it. |

## 6. Testing and verification

| # | Rule | Where stated | Why |
|---|---|---|---|
| T1 | **Test first** for behaviour: a failing test, then the code. Each fix in a review wave has a test that failed first. | Plans (tasks list failing tests first); M2a.3 execution record | A test written after the code tends to test what the code does, not what it should do. |
| T2 | **`npm test`, `npm run typecheck` and `npm run data:offline` pass before any task is called done.** | Every plan's verification steps | The minimum proof. |
| T3 | **Evidence before claims.** A result is reported with the command and its numbers; a skipped step is said plainly. | Process; review rules | Reports that are optimistic waste the next person's time. |
| T4 | **Fixtures are real fetched responses,** and expected numbers are read from them. | Task briefs (Tasks 5, 12, 13) | A made-up fixture tests the parser against our idea of the format, not the real one. |
| T5 | **Never run two Playwright runs at once** on one machine (they share `test-results/`). | `CLAUDE.md` | Runs overwrite each other's results. |
| T6 | **Run Vitest from PowerShell, not Git Bash,** on the Windows machine. | `Start here.md` §5; build notes | Git Bash breaks Vitest's workers ("failed to find the current suite"). |
| T7 | **End-to-end tests fail on any page error or shader error.** | M2 spec §7; e2e `afterEach` | Silent console errors hide real breakage. |
| T8 | **A flaky test is rerun alone and its cause named;** a timing assertion under machine load is not a code failure, but it is reported. | Execution records (M2b.3, M2b.4a) | So a real failure is not dismissed as a flake, and a flake does not block work. |

## 7. Process, git and collaboration

| # | Rule | Where stated | Why |
|---|---|---|---|
| G1 | **Each section has a spec approved by the user, then a plan, then a build.** | `Start here.md` §4 | Design talk first means the build solves the right problem. |
| G2 | **One branch and one PR per section or task.** Completed sections are merged into `main` with merge commits, bottom-up; branches are kept. | `CLAUDE.md`; `Start here.md` §3 | Each section can be reviewed and reverted on its own. Squash merges break stacked branches. |
| G3 | **Commit and push only when asked,** or as the agreed end-of-section step. Stage files by name. | `CLAUDE.md` | The user decides what leaves the machine. |
| G4 | **Commit messages end with** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; **PR bodies end with** `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. | `CLAUDE.md` | Attribution the user asked for. |
| G5 | **Subagent-driven builds:** a fresh implementer per task, a fresh reviewer per task (spec compliance, then code quality), fix rounds (at most 5), a whole-branch review on the most capable model, one fix wave, one scoped re-review. Per-task reviews on Sonnet, final reviews on Opus. | `Start here.md` §4 | Fresh eyes per task catch what the author cannot; the final review catches what crosses tasks. |
| G6 | **Rulings** (choices made on the user's behalf while building) are written with **what they cost if wrong**, into the plan's Execution record before scratch files are deleted. | `Start here.md` §3 | The user can reverse any ruling cheaply only if it is written down with its cost. |
| G7 | **Open questions go to the user as a list;** the builder carries on with what does not depend on the answer. | Session notes ("Open for the user") | Work does not stall, and the user sees every call. |
| G8 | **Never stop processes by name** (`taskkill /IM node.exe`, `pkill node`); stop only the process you started. | `CLAUDE.md` | Other work on the machine may be running node. |
| G9 | **Never include the user's name, project or personal details in requests to outside services;** research fetches use a generic user agent. | Environment rule; Task briefs | Privacy. |
| G10 | **Cloud sessions are shelved** (since 2026-11-15). | `CLAUDE.md`; [[Cloud sessions]] | The user's decision. |
| G11 | **Do not delete `Welcome.md`** without the user's consent. | `Start here.md` §3 | The user's request. |

## 8. Documentation and writing

| # | Rule | Where stated | Why |
|---|---|---|---|
| D1 | **The Obsidian vault is the project documentation and the record of past chats.** It is updated in the same piece of work as the code. | `CLAUDE.md`; `Start here.md` §2 | Documentation written later is documentation not written. |
| D2 | **Each session has a note in `Sessions/`:** requests in the user's words, decisions, the state at the end, open questions. | `Start here.md` §3 | The next chat starts from the record, not from memory. |
| D3 | **Each source family has a note in `Data Sources/`;** each module a note in `Architecture/`; each lasting choice a note in `Decisions/`. | `Start here.md` §2 | One place to look for each kind of question. |
| D4 | **Plain, short sentences** in user-facing text and in notes. | `CLAUDE.md` | The user asked for it; it also makes notes easier to check. |
| D5 | **The user's words are quoted exactly** when recording a decision; a reading of them is marked as a reading. | 0010 third decision; session notes | So a later reader can tell what the user said from what the builder understood. |
| D6 | **The sources register is generated,** not hand-written: `node scripts/sources-register.mjs`. | This handbook | So it cannot drift from what the app cites. |
