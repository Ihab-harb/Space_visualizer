---
title: Cloud task queue
date: 2026-10-16
status: open
milestone: process
tags: [plan, process, cloud, backlog]
---

# Cloud task queue

Back to [[Home]] · How to work: [[Cloud sessions]] · Setup: [[2026-10-16-cloud-sessions-setup]] · Backlog source: [[2026-10-05-m2a1-carry-over]]

Jobs a cloud session can take off the user's plate. Each one is self-contained: a cloud session reads [[Cloud sessions]], then its task here, and needs nothing else from chat.

**Current base branch:** `cloud-setup` (set 2026-10-30; the top of the stack, PR #7, which holds M2b.2 and these cloud notes). All tasks branch from it and target their PR at it. Once PRs #1–#7 are merged, the integrator pass changes this line to `main`.

**Only the integrator pass edits this note** (status, base branch). Cloud sessions record their work in their own session note.

## Order and parallel waves

| Wave | Tasks | Why this order |
|---|---|---|
| 0 | Q1 | Checks the environment and adds the repo files every later session relies on. Run it alone. |
| 1 | Q2, Q3, Q4 | No shared files. Q2 prepares the next section (M2b.2, the Moon). |
| 2 | Q5, Q6, Q7, Q8 | No shared files with each other. |
| 3 | Q9 | Changes what people see, so the user checks it locally before merging. |
| Later | Q10 | Research for M3, when M2 is near its end. |

## Status

| ID | Task | Status | Branch | PR |
|---|---|---|---|---|
| Q1 | Pilot and repo setup for cloud | open (CLAUDE.md and the hook exist locally on `cloud-setup`, uncommitted, 2026-10-29) | | |
| Q2 | Moon source research (M2b.2 prep) | open | | |
| Q3 | Details pipeline hardening | open | | |
| Q4 | Details store robustness | open | | |
| Q5 | Texture fetch and verify hardening | open | | |
| Q6 | Raster readers and texture tests | open | | |
| Q7 | Docs and test-title fixes | open | | |
| Q8 | Mission fact checks | open | | |
| Q9 | Header wording and accessibility | open | | |
| Q10 | Moons and dwarf planets source research (M3 prep) | later | | |

---

## Q1: Pilot and repo setup for cloud

**Branch:** `cloud-q1-setup` · **Needs first:** the user has done [[2026-10-16-cloud-sessions-setup]] Task 1 (GitHub App and the `space-visualizer` environment).

**Goal:** prove the environment works and add the repo files that make every later cloud session start right.

**Do:** [[2026-10-16-cloud-sessions-setup]] Tasks 2, 3 and 4 (root `CLAUDE.md`, the cloud-only `SessionStart` hook, the CI workflow), then the checks of Task 7 Steps 3–6 in this same session. Skip their "check locally on Windows" steps; list them as local follow-ups instead.

**Files:** `CLAUDE.md`, `.claude/settings.json`, `scripts/cloud-session-start.sh`, `.gitattributes`, `.github/workflows/ci.yml`, the setup plan's Execution record, your session note.

**Done when:**
- `node --version` prints `v24.`; `npm run typecheck` is clean; `npm test` passes;
- `npm run data` succeeds, or every blocked host is listed in the session note;
- `npx playwright test e2e/details.spec.ts` passes; the wall times of `npm test`, the details spec and (optionally) the full e2e run are recorded;
- the PR shows the CI workflow running green.

## Q2: Moon source research (M2b.2 prep)

**Branch:** `cloud-q2-moon-research` · **Output:** `Space_visualizer/Research/2026-10-moon-sources.md` (new folder) and your session note. **No code, no data files.**

**Goal:** give the M2b.2 design discussion every official source it needs, so the user's brainstorming starts from facts. The Moon is not in `public/data/solar-system/bodies.json` yet.

**Find, for each item, the official page or product, its URL, what it provides, its format and size, and its licence or usage note:**
1. **Position:** an official source for the Moon's geocentric position across the app's time range (−4712 to 9999, accurate 1800–2050). Candidates to check: JPL Horizons (already used as the accuracy reference, see [[JPL Horizons]]), JPL ephemeris documentation, NASA/JPL published series. State how the M1 accuracy measurement ([[0004-measured-accuracy]]) could be applied.
2. **Physical facts:** the NSSDCA Moon Fact Sheet (the parser for planet sheets is `pipeline/sources/nssdcPlanetSheet.ts`; note format differences).
3. **Rotation and orientation:** the Moon's IAU model in NAIF PCK00011 ([[NAIF PCK00011]]); say whether the existing `naifPck.ts` parser covers its terms.
4. **Imagery:** USGS/NASA global Moon products (for example the LRO LROC WAC global mosaic and the LOLA elevation model). Sizes and resolutions only. **Do not download them** (texture work stays local).
5. **Interior, atmosphere (exosphere), magnetic field:** official NASA pages with exact sentences, in the style of `pipeline/reference/interiors.json` (each value with its sentence).
6. **Missions:** key missions with launch and arrival dates and their quotes, in the style of `pipeline/reference/missions.json`. Include Apollo 8, already researched (source `nasa-mission-apollo-8`, https://www.nasa.gov/mission/apollo-8/, quote "crew Frank Borman, James Lovell Jr., William Anders Launch Dec. 21, 1968 SPLASHDOWN Dec. 27, 1968").
7. **Named features:** the USGS Gazetteer Moon download (zip URL and size, number of approved features, the diameter cut-off for the top 200, as was done for Mars: 2,052 features, cut-off near 499 km).

**Also list:** open questions for the design discussion (for example, Earth–Moon scale in the overview, the "0.00 AU" header problem noted in the carry-over, eclipse occluders), and anything that looked official but was not.

**Done when:** the note covers all seven items, every claim has a URL, and quotes are copied exactly (not paraphrased).

## Q3: Details pipeline hardening

**Branch:** `cloud-q3-details-pipeline` · **Scope:** the M2b.1 items in [[2026-10-05-m2a1-carry-over]] under "From M2b.1 (Tasks 1–4)" for the fact-sheet parser, zip, dBASE, Gazetteer and quote checks, and under "From M2b.1 (Tasks 5–9)" → Build.

**Files:** `pipeline/build/buildDetails*`, `pipeline/run.ts`, `pipeline/sources/{nssdcPlanetSheet,gazetteer,quotedReference}*`, `pipeline/lib/{dbf,zip}*`, `pipeline/reference/*.test.ts`. Not `missions.json` or `interiors.json` (Q8 may edit those).

**Do, test first for each:**
- `buildDetails` warns (does not stay silent) when the mean-radius parse fails and it falls back;
- `run.ts` removes details files for bodies no longer built;
- a data run does not rewrite `retrievedAt` for sources whose content did not change;
- quote checks: reject a lower-case word before a day number ("the probe 2 August 1977"), reject "July of 1965" / "July, 1965" / "summer 1965" for the year-only rule, accept "Launched 20 August 1977" and hostnames with a trailing dot;
- `verifyInteriors` rejects min > max;
- Gazetteer: reject NaN latitude or longitude before the schema; `approvedYear` "0000" becomes null, not 0;
- the dBASE and zip test gaps listed in the carry-over (leading spaces in numerics, short buffers, the version byte; the two zip tests assert *which* error is thrown);
- the fact-sheet parser throws (does not silently return null) on a reworded dipole tilt, longitude, offset, surface-field or pole line.

**Done when:** each item has a test that failed before the change; `npm test` and `npm run typecheck` pass; `npm run data` produces no change in `public/data` other than what the items intend (list any in the session note). Skip any item whose fix needs a design choice; list it as a local follow-up.

## Q4: Details store robustness

**Branch:** `cloud-q4-details-store` · **Scope:** carry-over "From M2b.1 (Tasks 5–9)" → Store.

**Files:** `src/state/detailsStore.ts`, `src/state/detailsStore.test.ts`.

**Do, test first:** a fetch timeout so a hung request ends in the error state (pick a value and record it as a ruling); error messages that name the body for a non-JSON 200 and for a network error; tests for retry while loading, retry from missing, HTTP 500, a non-JSON 200, an undefined id, StrictMode double effects; strengthen the "keyed by id" test.

**Done when:** the new tests failed first and now pass; `npm test`, `npm run typecheck` and `npx playwright test e2e/details.spec.ts` pass.

## Q5: Texture fetch and verify hardening

**Branch:** `cloud-q5-fetch-verify` · **Scope:** carry-over "Pipeline hardening (small)" → `fetchBinary` and `verifySources`.

**Files:** `pipeline/textures/fetchBinary.ts`, `pipeline/textures/fetchBinary.test.ts`, `pipeline/textures/verifySources.ts`.

**Do, test first, using mocked responses (no real downloads):** compare `meta.url` on a cache hit; no false failure when Content-Length is set with a content-encoding; create cache subfolders; cancel the response body on a non-OK status; tests for HTTP errors; a HEAD timeout in `verifySources` and a comparison against `approxBytes`.

**Done when:** tests pass without network access to the imagery hosts. Do **not** run `npm run textures` (multi-GB). `npm run textures:verify` (HEAD requests only) may be run once and its output recorded.

## Q6: Raster readers and texture tests

**Branch:** `cloud-q6-raster-tests` · **Scope:** carry-over "Pipeline hardening (small)" → signed TIFF reader and Tests.

**Files:** `pipeline/textures/{rasters,derive,stars,manifest,build}*` (not `fetchBinary*` or `verifySources.ts`, which belong to Q5).

**Do, test first:** check the TIFF IFD read results; read every SampleFormat value; edge-case tests (big-endian, multi-row strips); `derive` edge cases (`calibrateMask` with empty lists, `rollColumns` with a 0 shift); a synthetic EXR test for the star-map decoder; schema rejection tests; a test that `sky` is absent from `bodies.json`; tests for `committedBytes` and the budget gate. Synthetic inputs only.

**Done when:** `npm test` and `npm run typecheck` pass; no texture output in `public/textures` changes.

## Q7: Docs and test-title fixes

**Branch:** `cloud-q7-docs`

**Do:**
- `Space_visualizer/Architecture/render.md` line 135: rewrite the garbled sentence ("three loads … (re-measured …; two loads) gave") so it plainly says how many loads were measured and what each measurement showed. Do not change the numbers;
- `src/ui/hotkeys.test.ts`: fix the mangled section sign in the describe title;
- `pipeline/reference/README.md` line 43: the example error "arrival 1965-07-14 not in any quote" names a date that *is* in its quote; use an example that would really fail;
- `Space_visualizer/Architecture/pipeline.md` line 33 says committed textures total about 14.1 MB: check it against the budget validator's output and correct it only if it differs.

(Already done before this queue was written: the Mars Interior screenshots were retaken in commit `e0e755f`.)

**Files:** only those named above, plus your session note. (The vault ownership rule allows these two Architecture notes for this task.)

**Done when:** each fix is made and `npm test` passes.

## Q8: Mission fact checks

**Branch:** `cloud-q8-missions` · **Scope:** carry-over "From M2b.1 (Tasks 5–9)" → Missions, and "Deferred from the M2b.1 whole-branch review" → Akatsuki.

**Files:** `pipeline/reference/missions.json`, the regenerated `public/data/solar-system/details/*.json` and `public/data/sources.json` it changes.

**Do:** verify Akatsuki's end of operations (2024) against an official JAXA or NASA page and add its quote, or remove the end date if no official page states it; check Venus Express's end date wording against ESA (contact lost 2014-11-28, announcement 2014-12-16) and make the entry say which one it is; look for official NASA pages that quote the Venera 7 and 13 dates more cleanly than the current quotes. Each change keeps the rule: the exact sentence is on the page, and `npm run data` checks it.

**Done when:** `npm run data` passes its quote checks; the data diff contains only the intended mission changes (revert `retrievedAt`-only changes); `npm test` passes.

## Q9: Header wording and accessibility

**Branch:** `cloud-q9-ui-a11y` · **Scope:** carry-over "From M2a.3" → Header and narrative, Control panel, Drawer.

**Files:** `src/ui/Header.tsx`, `src/ui/ControlPanel.tsx`, `src/ui/FactsDrawer.tsx`, their tests, and the number-formatting helper the header uses.

**Do, test first:** rounding that crosses a unit boundary (59.96 s must not show "60.0 s"; 119.6 min must not show "120 min"; never "1 hours"); the Facts button's visible label includes "(F)"; the Realistic button is not a focusable pressed button without a handler; the disabled Exhibit button uses `aria-disabled` so its "arrives in M2c" title reaches keyboard and touch users; the drawer moves focus in on open and restores it on close; the drawer's highlight timeout is cleared on unmount.

**Done when:** unit tests pass; the layout and details e2e specs pass; screenshots of the header and drawer at 1280×720 and 390×844 (taken with a scratch Playwright script, as in the M2b.1 plan Task 10) are committed to `Space_visualizer/Assets/q9/` and named in the PR body, for the user to check by eye.

## Q10: Moons and dwarf planets source research (M3 prep, later)

**Branch:** `cloud-q10-m3-research` · **Output:** `Space_visualizer/Research/<date>-m3-sources.md`. No code.

**Goal:** list the official sources M3 needs (dwarf planets and major moons; see the M2 spec §3 milestone table): orbital elements or ephemerides, physical parameters (JPL SSD satellite pages, NSSDCA), IAU rotation models (NAIF PCK), official global maps, and Gazetteer coverage, each with URL, format, size and licence, and the gaps where no official source exists.
