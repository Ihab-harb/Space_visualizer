---
title: Code quality and requirements
tags: [handbook, quality, requirements]
date: 2026-11-19
---

# Code quality and requirements

Back to [[Handbook]] · Rules: [[Rules]] · Setup and commands: `docs/SETUP.md`

What the app must do, how well, and the standards the code is held to.

## 1. Requirements

### 1.1 Goals and success criteria (design spec §1, M2 spec §1)
| Requirement | Measure | Status (2026-11-19) |
|---|---|---|
| Positions match JPL Horizons within each model's documented accuracy, for any date in range | Tests against committed Horizons vectors; measured error stored and shown | Met (planets within 3× nominal, Neptune Table 1 within 10×; Moon ≤ 0.904 km inside its table) |
| Every displayed value links to its source; the build fails if one lacks a source | Zod and `sourceId` resolution; citation UI tests | Met |
| Accuracy, information and visuals equally weighted | Design reviews and golden views | Ongoing |
| 60 fps on a mid-range laptop; 60 fps at High on a desktop GPU and at Medium on a mid-range laptop; Auto settles without oscillating | `npm run perf` on a real GPU; Auto controller tests | Not yet measured on a discrete GPU; the dev machine's integrated GPU runs about 100 ms per frame at High and Medium, so Auto settles at Low ([[render]]) |
| Golden views pass the look checklist in both styles | Reviewed screenshots in `Assets/` | Realistic style met; Exhibit style is M2c |
| No regressions in accuracy tests or the citation rule | `npm test` | Met |

### 1.2 Functional requirements, by section (each spec has the full list)
- **M1 Foundation:** Sun and eight planets at their real positions for any date; time controls (play, pause, reverse, speed steps, date input, Now, validity warning); Orbit and Follow views; information panel with every value cited; regions interface; URL state. [[2026-10-04-solar-system-visualizer-design]]
- **M2a.1 Imagery and shading:** official surface maps per body with tiered textures; Earth's night lights, clouds and atmosphere; relief from elevation; Hubble OPAL giants; rings with shadows; animated Sun; the star sky. [[2026-10-04-m2a1-imagery-and-shading]]
- **M2a.2 Effects and quality:** bloom, god rays, lens flare, streaks, depth of field, AgX tone mapping with scene-driven exposure, chromatic aberration, vignette, grain; Camera-effects toggle; Auto, High, Medium and Low quality. [[2026-10-05-m2a2-cinematic-effects-and-quality]]
- **M2a.3 Interface and Tour:** header with headline, chips and a narrative; glass control panel; pill labels; facts drawer with Imagery; Tour; Venus radar view; keyboard shortcuts. [[2026-10-07-m2a3-interface-and-tour]]
- **M2b.1 Body details:** interior layers, atmosphere composition, magnetic field, missions and discovery, named features, each cited. [[2026-10-10-m2b1-body-details-design]]
- **M2b.2 The Moon:** accurate Moon position, Earth off the barycentre, Moon imagery and shading, eclipses, phase. [[2026-10-29-m2b2-moon-design]]
- **M2b.3 Explore:** Explore mode with Exploded and Half-section interior views, floating layer labels, depth ruler, composition chart. [[2026-10-30-m2b3-explore-interior-design]]
- **M2b.4a Feature pins:** Surface and Interior tabs; landmark pins with cited cards; an All features list with search; turn-to-feature; Earth landmarks worldwide; size note; feature light. [[2026-11-15-m2b4a-feature-pins-design]]
- **Next:** M2b.4b magnetic field lines and aurora; M2b.5 chapters; M2c Exhibit mode; M3–M7 per the M2 spec §3.

### 1.3 Non-functional requirements
| Area | Requirement | Where stated |
|---|---|---|
| **Offline and static** | The app runs from committed files with no network at run time; deployable as a static site (M7) | Design spec §1, §4.3 |
| **Scale** | No jitter from a moon's surface to the edge of the Solar System; architecture ready for galaxy scales | [[0003-floating-origin-and-log-depth]] |
| **Error handling** | Core data fails: full-screen error with Retry. Optional data fails: the app continues with a notice. No WebGL: an explanatory message. Texture missing: labelled plain colour. Details loading or failed: a status line and Retry. Out-of-range dates: warning and "approximate" marks | Design spec §8; M2b.3 and M2b.4a fix waves |
| **Robustness** | Dates far outside every model range stay finite (no `NaN`); a backgrounded tab advances time by at most a capped step; degenerate camera poses never produce `NaN` matrices; invalid date input is rejected with a readable message | M1 plan Review Focus |
| **Accessibility** | Full keyboard operation; ARIA labels and roles; focus kept inside the overlay when items disappear; `prefers-reduced-motion` respected (transitions cut) | Design spec §7; M2a, M2b specs |
| **Responsive** | Panels become bottom sheets on phones; labels become numbered dots with a list; tested at five viewports | M2 spec §4, §7; `e2e/layout.spec.ts` |
| **Size** | Committed textures ≤ 60 MB; the Moon table about 2 MB | [[0006-webp-tiers-ktx2-deferred]]; [[0008-moon-chebyshev-table]] |
| **Reproducibility** | `npm run data:offline` rebuilds all data from the cache with no network | Design spec §4.3 |
| **Honesty** | Illustrative visuals labelled; estimates labelled; measured accuracy shown; out-of-range positions marked | M2 spec §2; [[0004-measured-accuracy]]; [[0009-peer-reviewed-papers-for-estimates]] |

## 2. Code standards

### 2.1 Language and structure
- **TypeScript 7, `strict: true`,** ESM, `verbatimModuleSyntax`, `isolatedModules`. `npm run typecheck` must be clean.
- **Pure core:** `src/core` imports nothing from React, three.js, stores or UI. Pure functions are tested directly.
- **Pure models beside thin React wiring:** quality, exposure, camera turns, label layout, feature lists and the feature light are pure functions; the components only apply them. This keeps behaviour testable without WebGL.
- **One owner per concern** (keys, quality, the Explore frame geometry) and a fixed frame order.
- **Small, focused files;** a file that grows a lot in one change is flagged in review.
- **No new dependencies** without a reason; existing patterns first (cached fetchers, the source registry, Zod schemas).

### 2.2 Data code
- Every fetcher goes through the cache (`fetchCached`, `fetchBinaryCached`), so offline builds work.
- Every parser has tests on real recorded fixtures.
- Validation errors name the exact field path; the build writes nothing on any failure.
- Curated values are checked against their quoted sentence on the fetched page.

### 2.3 Rendering code
- Custom `ShaderMaterial`s with log-depth chunks, object-space lighting with directions computed in float64, ASCII-only and NaN-safe GLSL.
- Materials and geometries created in `useMemo` are disposed.
- Look constants live in one place (`illustrative.ts`, `quality.ts`, the effects modules), named, with the reason for their value recorded when tuned.

### 2.4 Interface code
- Every value rendered with its citation number; sources listed and linked.
- Accessible names and roles on every control; keyboard paths for everything a pointer can do (one known gap: Tab does not reach the pins, left for later by the user; the list gives a full keyboard path).
- Esc steps back one level at a time (chart, card, list, then leave).

## 3. Testing

| Layer | Tool | What it covers | Size (2026-11-19) |
|---|---|---|---|
| Unit | Vitest (`npm test`) | Core maths and ephemerides against Horizons, time scales, Kepler edge cases, parsers on fixtures, quote checks, build checks, stores, camera and layout maths, UI components with Testing Library, placement guards on the committed maps | 1,251 tests in 124 files |
| Type | `tsc --noEmit` (`npm run typecheck`) | The whole repo | Clean |
| Data | `npm run data:offline` | Every value sourced, every quote on its page, every record found and in its country | 216 sources, 10 bodies, 10 details files |
| End-to-end | Playwright with SwiftShader (`npx playwright test`) | App load, selection, views, quality presets, effects toggle, Tour, drawer, details, Explore, pins, layout at five viewports, golden views; fails on any page or shader error | 8 spec files; the last full run (2026-11-15) had 144 tests, 137 passing in one pass and the rest on rerun |
| Performance | `npm run perf` (real GPU, local only) | Frame time per preset; Auto settling | Measured on the integrated GPU only |
| Visual | Golden screenshots in `Assets/` | The look checklist | Reviewed per visual task |

**Practices:** test first; a failing test for every fix; fixtures from real responses; no pixel diffs; one Playwright run at a time; Vitest from PowerShell on Windows.

## 4. Review gates
1. **Per task:** a fresh reviewer checks spec compliance (missing, extra, misunderstood) and code quality (separation, error handling, duplication, edge cases, tests that assert something real). Findings are graded Critical, Important or Minor; Critical and Important are fixed before the task closes.
2. **Per branch:** a whole-branch review on the most capable model, one fix wave, one scoped re-review.
3. **Deferred minor findings** go to the carry-over note ([[2026-10-05-m2a1-carry-over]]) with their section.

## 5. Known quality debts (summary)
The full, current list is in [[2026-10-05-m2a1-carry-over]]. The main ones:
- No measurement on a discrete GPU yet; the interior colours and the feature light are unchecked on real GPUs.
- The network data build fails on two Venera quotes since NSSDCA moved its chronology page to a script-loaded app (offline build still works from the cache).
- Tab does not reach the pins; the feature list stays open beside the card on desktop (both left for later by the user).
- The interior wording table lives in the UI instead of the data.
- Pipeline fetches have no timeout of their own (a down service waits several minutes before the cache is used).
- `schemaVersion` stays 1 though fields became required.
