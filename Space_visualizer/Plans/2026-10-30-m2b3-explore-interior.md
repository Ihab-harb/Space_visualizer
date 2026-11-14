---
title: M2b.3 Explore mode, interior cutaway and composition charts — Implementation Plan
date: 2026-10-30
status: complete
milestone: M2b.3
spec: "[[2026-10-30-m2b3-explore-interior-design]]"
tags: [plan, m2b, interior, charts]
---

# M2b.3 Explore mode, interior cutaway and composition charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Back to [[Home]] · Spec: [[2026-10-30-m2b3-explore-interior-design]] · Session: [[2026-10-30-session-m2b3-explore]]

**Goal:** an Explore mode for one selected body that opens its interior in Exploded and Half-section views, with floating cited layer labels and a ranked log-scale composition chart; research-paper estimates fill the interiors of Venus and the giant planets.

**Architecture:** a new `exploreStore` (Zustand) owns the mode, view and transition progress; pure geometry in `src/core/interior/` turns cited layer radii into drawable shells and explode offsets; a new `src/scene/interior/` renders the shells, cut faces and floating labels inside the existing R3F scene; a new `src/ui/explore/` overlay holds the view switch, ✕, the composition strip, the full chart and the layer card. The pipeline's curated-reference checker gains a "peer-reviewed paper" source kind with the same quote verification.

**Tech Stack:** TypeScript, React, React Three Fiber / three.js (custom GLSL, log depth), Zustand, Zod, Vitest, Playwright (SwiftShader), tsx pipeline.

**Spec:** `Space_visualizer/Specs/2026-10-30-m2b3-explore-interior-design.md`. Executors read it first; §10 lists the calls.

## Global Constraints
- Every value shown carries its citation `[n]` from the shared citation model; values from papers are marked "Estimate"; illustrative visuals (interior colours, thickened thin layers, illustrative sizes) are labelled.
- Research papers: peer-reviewed journal article with a DOI; quote verified on a fetched page (DOI page or open abstract, else an open copy of the same published paper on arxiv.org, ncbi.nlm.nih.gov/pmc, or ui.adsabs.harvard.edu); never hand-verified; never a preprint that was not published.
- `src/core` stays pure (zod only). Every ShaderMaterial includes three's logdepthbuf chunks; every geometry/material made in `useMemo` is disposed.
- Hotkeys stay in `src/ui/hotkeys.ts` (the single owner). Keys: **X** enters Explore (a body selected); in Explore **1/2/3** = Whole/Exploded/Half-section, **Esc** closes the chart panel first, then leaves; outside Explore 1/2/Esc keep Orbit/Follow/Orbit.
- Reduced motion: transitions become cuts.
- Layout tests at 390x844, 800x1000, 1024x768, 1100x800, 1280x720 stay green; Explore adds its own no-overlap checks.
- Plain, short sentences in user-facing text.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; stage only the task's files; never `git add -A`. Never run two Playwright runs at once; stop only processes you started.

## Review Focus
1. **Leaving mid-transition** (Esc or ✕ while layers are still moving): time, camera, rings, interface and rotation all come back exactly as before; no half-open body (Task 1 and Task 6 tests).
2. **Selection changes while in Explore** (clicking another body's label, `Deselect`, a URL with another target): Explore leaves cleanly first; nothing stays hidden (Task 1 test).
3. **Tour while in Explore** (T key): ignored in Explore; and entering Explore stops a running tour (Task 1 test).
4. **Resize or phone rotation in Explore:** labels re-lay out with no overlaps against the top bar or bottom strip (Task 6 label-layout test with two viewport sizes).
5. **Ranges and illustrative layers** (min ≠ max, `estimate`, no number): geometry never yields NaN or inverted shells; bands render; labels show "Estimate" or "Illustrative size" (Task 2 tests).

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/state/exploreStore.ts` (new) | Mode, view, transition progress, saved time/camera state, chart panel, selected layer | 1 |
| `src/ui/hotkeys.ts`, `src/state/urlParams.ts`, `src/App.tsx`, `src/ui/Header.tsx`, `src/ui/ControlPanel.tsx` (key hint) | Entry points | 1 |
| `src/core/interior/geometry.ts` (new) | Drawable shells from cited layers; thin-layer minimum; bands; explode offsets; section plane | 2 |
| `src/core/details/schema.ts`, `checks.ts`, `pipeline/sources/quotedReference.ts`, `pipeline/build/buildDetails.ts`, `pipeline/reference/README.md`, `Space_visualizer/Decisions/0009-peer-reviewed-papers-for-estimates.md` (new) | Paper sources and `estimate` layers | 3 |
| `pipeline/reference/interiors.json`, regenerated `public/data/solar-system/details/{venus,jupiter,saturn,uranus,neptune}.json`, `public/data/sources.json` | Researched interiors | 4 |
| `src/ui/explore/compositionModel.ts` (new), `src/ui/explore/CompositionChart.tsx` (new) | Ranked log-scale chart model and component, table view | 5 |
| `src/scene/interior/*` (new), `src/scene/BodyMesh.tsx`, `src/scene/materials/*` (cut support), `src/scene/materials/RingShell.tsx`, `src/camera/CameraSystem.tsx`, `src/render/EffectsStack.tsx` / `sunFx.ts` | Interior rendering, transitions, dimming, rings, Sun, camera framing, DOF focus | 6 |
| `src/ui/explore/ExploreOverlay.tsx` (new), `src/ui/explore/LayerCard.tsx` (new), `src/ui/explore/labelLayout.ts` (new), `src/scene/interior/InteriorLabels.tsx` (new), `src/styles/*` | Overlay, floating labels, layer card, phone variant | 7 |
| `e2e/explore.spec.ts` (new), `e2e/golden.spec.ts`, `e2e/layout.spec.ts` | End-to-end and golden views | 8 |
| Vault and docs | Notes, ADR, session, plan record | 9 |

---

### Task 1: Explore state, entry points and keys

**Files:** Create `src/state/exploreStore.ts`, `src/state/exploreStore.test.ts`. Modify `src/ui/hotkeys.ts` (+ test), `src/state/urlParams.ts` (+ test), `src/App.tsx`, `src/ui/Header.tsx` (+ test), `src/ui/ControlPanel.tsx` (key hint text).

**Interfaces — Produces:**
```ts
type ExploreView = 'whole' | 'exploded' | 'section';
interface ExploreState {
  active: boolean; bodyId: string | null; view: ExploreView;
  /** 0 = whole, 1 = target view fully open; animated by the scene (Task 6). */
  progress: number;
  chartOpen: boolean; selectedLayerId: string | null;
  /** Bumped when Half-section is chosen again, so the scene re-faces the cut to the camera. */
  sectionSeq: number;
  saved: { playing: boolean; rateIndex: number } | null;
  enter(bodyId: string): void;   // stops the tour, saves and pauses time, opens at 'whole'
  leave(): void;                 // restores time; closes chart; clears selection of layer; active=false
  setView(v: ExploreView): void; // 'section' again → sectionSeq+1
  setProgress(p: number): void;
  toggleChart(open?: boolean): void;
  selectLayer(id: string | null): void;
}
```
- Hotkeys: new actions `'explore'` (X/x: enter when a body is selected and not active), `'exploreView1|2|3'` (only when active), and Esc while active → close chart if open, else `leave()`. T is ignored while active. 1/2/Esc keep their old meaning when not active.
- Selection: when `selectionStore.selectedId` changes to another id or null while active → `leave()` (subscribe in the store module or an App-level effect; one place).
- URL: `explore=1` (with a valid `target`) and `view=whole|exploded|section`; `parseUrlOverrides` returns `explore?: boolean`, `exploreView?: ExploreView`; `applyUrlOverrides` enters after the target is applied.
- Header: an **Explore** button next to Facts & sources, `aria-pressed` false, keyboard hint "(X)". `App.tsx`: while active, the Header, ControlPanel, FactsDrawer and BottomBar are not rendered (or hidden with `inert` + `aria-hidden`; pick one and test it); the overlay arrives in Task 7.
- Camera saving and framing are Task 6's (scene side); the store keeps only time state.

- [ ] **Step 1: failing tests** — `exploreStore.test.ts`: enter pauses time and remembers play state and rate; leave restores both; enter stops an active tour; setView('section') twice bumps `sectionSeq`; leave while `progress` is 0.5 resets progress to 0 and closes the chart (Review Focus 1); selecting another body while active leaves (Review Focus 2). `hotkeys.test.ts`: X enters only with a selection; 1/2/3 map to views only when active and to orbit/follow otherwise; Esc closes the chart first then leaves; T ignored when active (Review Focus 3). `urlParams.test.ts`: `explore=1&view=section` parsed; `explore=1` without target is ignored on apply. `Header.test.tsx`: the Explore button calls enter with the selected id.
- [ ] **Step 2: run** `npx vitest run src/state src/ui/hotkeys.test.ts src/ui/Header.test.tsx` — FAIL.
- [ ] **Step 3: implement.**
- [ ] **Step 4: run** `npm test`, `npm run typecheck` — PASS; `npx playwright test e2e/interface.spec.ts e2e/layout.spec.ts` — PASS (normal interface unchanged).
- [ ] **Step 5: commit** · `feat(explore): Explore state, Explore button, X and view keys, URL parameters`.

### Task 2: Interior geometry (pure)

**Files:** Create `src/core/interior/geometry.ts`, `geometry.test.ts`.

**Interfaces — Consumes:** `InteriorLayer` (`src/core/details/schema.ts`; Task 3 adds `estimate?: boolean`, and `outerRadiusKm`/`innerRadiusKm` may be absent for an illustrative-size layer — see Task 3). **Produces:**
```ts
interface DrawnLayer {
  id: string; name: string;
  /** Radii as fractions of the body's drawn radius (1 = surface), outer > inner. */
  outer: number; inner: number;
  /** Soft band widths (fraction of radius) where a bound is a range; 0 for a sharp boundary. */
  outerBand: number; innerBand: number;
  thickened: boolean;     // drawn thicker than scale (spec §6, < 1 % of radius)
  sizeKind: 'cited' | 'estimate' | 'illustrative';
  state: InteriorLayer['state'];
}
function drawnLayers(layers: readonly InteriorLayer[], bodyRadiusKm: number, opts?: { minThickness?: number /* default 0.012 */ }): DrawnLayer[];
function explodeOffsets(layers: readonly DrawnLayer[], progress: number): number[]; // per layer, along screen-up, in body radii; 0 at progress 0; outermost lifts most
function sectionVisible(view: 'whole'|'exploded'|'section', progress: number): { cut: boolean; explode: number };
```
- Mid-point of a range is the drawn boundary; the band is the range width / radius.
- Thickening pushes the inner bound of a too-thin outermost layer inward and shifts nothing else beyond what is needed to keep layers ordered; inner layers never invert.
- Illustrative-size layers (no numbers) share the remaining radius evenly between their cited neighbours (or between the surface and the centre).

- [ ] **Step 1: failing tests** — Earth (cited: 6371/6341/3485/1221/0) → four layers, crust `thickened: true` with `outer - inner ≥ 0.012`, mantle inner = 3485/6371; a range bound (Jupiter-like 0.3–0.5 R) → band 0.2 and boundary 0.4; two illustrative layers between cited 0.8 and 0 split at 0.4; no NaN or inverted layer for any input in a small table of cases (Review Focus 5); `explodeOffsets` 0 at progress 0, monotonic in layer order at progress 1.
- [ ] **Step 2: run** `npx vitest run src/core/interior` — FAIL. **Step 3: implement.** **Step 4:** PASS; `npm run typecheck`.
- [ ] **Step 5: commit** · `feat(core): interior geometry for the cutaway (shells, bands, thin layers, explode offsets)`.

### Task 3: Peer-reviewed paper sources and estimate layers

**Files:** Modify `src/core/details/schema.ts`, `src/core/details/checks.ts` (+ tests), `pipeline/sources/quotedReference.ts` (+ test), `pipeline/build/buildDetails.ts` (+ test), `pipeline/reference/README.md`. Create `Space_visualizer/Decisions/0009-peer-reviewed-papers-for-estimates.md` (staged in Task 9).

**Interfaces — Produces:**
- Curated source entry gains an optional kind: `{ id, title, publisher, url, license, kind?: 'official' | 'paper', doi?: string, journal?: string, quoteUrl?: string }`. For `kind: 'paper'`: `doi` required (`10.xxxx/...`), `url` = `https://doi.org/<doi>`, `journal` from the list in `TRUSTED_JOURNALS` (Nature, Science, Nature Astronomy, JGR Planets, Geophysical Research Letters, Icarus, The Planetary Science Journal, Astronomy & Astrophysics, The Astrophysical Journal, Annual Review of Earth and Planetary Sciences, Space Science Reviews), and `quoteUrl` optional: an open copy on `arxiv.org`, `ncbi.nlm.nih.gov` (PMC), or `ui.adsabs.harvard.edu` (`OPEN_COPY_HOSTS`). The quote check fetches `quoteUrl ?? url`.
- `InteriorLayerSchema`: `estimate: z.boolean().optional()`; `sizeKind: z.enum(['cited','estimate','illustrative']).optional()` (default cited); for `illustrative`, `outerRadiusKm`/`innerRadiusKm` become optional — implement as a refined union so cited layers keep both bounds required. `checkDetails`: an illustrative layer must have neighbours that give it room; ordering rules unchanged for numbered layers.
- `Source` records for papers in `sources.json` keep the schema's fields (title = paper title, publisher = journal, url = doi URL, license = "Peer-reviewed article; quoted under fair use").
- README: a "Research papers" section with these rules.
- ADR 0009: context (no official numbers for Venus and giants), decision (user, 2026-10-30), rules, consequences.

- [ ] **Step 1: failing tests** — a paper source without DOI is rejected; a paper on a non-listed journal is rejected; a `quoteUrl` on an unlisted host is rejected; the quote check uses `quoteUrl` when present; an `estimate` layer from a percent bound converts like M2b.1 (`from: 'percent'`, `stated` kept); an illustrative layer without bounds validates between cited neighbours and fails as the only layer of a body with no cited bounds at all only if it has no neighbours (decide and test the exact rule: an all-illustrative interior is allowed, sharing the radius evenly).
- [ ] **Step 2: run** `npx vitest run pipeline src/core/details` — FAIL. **Step 3: implement.** **Step 4:** PASS; `npm run typecheck`; `npm run data:offline` — no data change (no papers yet).
- [ ] **Step 5: commit** · `feat(details): peer-reviewed paper sources and estimate/illustrative interior layers`.

### Task 4: Research the interiors of Venus and the giant planets

**Files:** `pipeline/reference/interiors.json`; regenerated `public/data/solar-system/details/{venus,jupiter,saturn,uranus,neptune}.json` and `public/data/sources.json`; the research log goes in the task report and then the plan's Execution record.

**Do (spec §4.2):**
- For each body, the layer names and order from an official NASA page in words (quoted), then sizes from official numbers where they exist, else from trusted papers (fractions converted with the cited mean radius, ranges kept), else illustrative size.
- Targets: Venus (crust, mantle, core); Jupiter (molecular H/He envelope, metallic hydrogen, dilute core — Juno); Saturn (envelope, metallic hydrogen, diffuse core — Cassini ring seismology); Uranus and Neptune (H/He envelope, water–ammonia–methane mantle, rocky core).
- Record every candidate considered and why it was kept or rejected.
- **Done when:** `npm run data` passes the quote checks; each of the five bodies has a non-null interior; `npm test` passes; the data diff contains only these bodies' details and their sources (revert `retrievedAt`/`generatedAt`-only noise).
- [ ] Commit · `data(details): interiors of Venus and the giant planets from NASA descriptions and peer-reviewed estimates`.

### Task 5: Composition chart (model and component)

**Files:** Create `src/ui/explore/compositionModel.ts` (+ test), `src/ui/explore/CompositionChart.tsx` (+ test).

**Interfaces — Produces:**
```ts
interface ChartBar { name: string; formula: string; value: number; unit: '%' | 'ppm' | 'cm⁻³'; logValue: number; label: string; upperLimit: boolean; uncertainty: number | null; sourceId: string }
interface ChartModel { title: string; axis: 'ppm' | 'per-cm3'; bars: ChartBar[]; ticks: Array<{ value: number; label: string }>; note: { text: string; sourceId: string } | null }
function compositionModel(body: Body, details: BodyDetails): ChartModel | null; // null → no chart (note-only or no data)
function compositionPreview(model: ChartModel | null, details: BodyDetails): { parts: Array<{ text: string; sourceId?: string }> }; // the strip: top two gases, the note, or "No atmosphere"
```
- Percent converts to ppm only for placement on the axis (`logValue = log10(ppm)`); `label` keeps the source unit ("78.08 %", "420 ppm"). Bars sorted by value, descending. Exosphere: axis `per-cm3`, bars `upperLimit: true`, title "Exosphere · particles per cm³ (upper limits)". Title names the basis from the data's note (spec §5): "Atmosphere · by volume" by default, "Photosphere" for the Sun.
- Component: SVG bars (thin, rounded ends, one hue from the app accent palette; text in text colours), value label at each bar end, `[n]` per bar using the shared `citationModel`, tooltip on hover/focus (full name, value, unit, uncertainty, source title), and a "Table" toggle that renders the same rows as a `<table>`.
- [ ] **Step 1: failing tests** — Earth: N₂ first, H₂ last, 9 bars, N₂ label "78.08 %", CO₂ label "420 ppm", ticks cover 0.1 ppm … 1,000,000 ppm; the Moon: axis per-cm3 and all `upperLimit`; Mercury (note only) → `null` and preview shows the note; a body without atmosphere → preview "No atmosphere"; component renders a table with the same rows; every bar has a `[n]`.
- [ ] **Step 2–4:** RED → implement → GREEN; `npm run typecheck`.
- [ ] **Step 5: commit** · `feat(explore): ranked log-scale composition chart`.

### Task 6: Interior rendering in the scene

**Files:** Create `src/scene/interior/InteriorModel.tsx`, `src/scene/interior/interiorMaterial.ts` (GLSL; heat palette per state), `src/scene/interior/useExploreTransition.ts`, `src/scene/interior/interiorPalette.ts` (+ test). Modify `src/scene/BodyMesh.tsx`, `src/scene/materials/createBodyMaterial.ts` (clip support for the outer shell), `src/scene/materials/RingShell.tsx` (hidden when the body is opened), `src/camera/CameraSystem.tsx` (frame the body on enter; save and restore the pose on leave), `src/render/EffectsStack.tsx` and/or `src/render/sunFx.ts` (Sun: corona, flare, god rays off and bloom reduced in Explore; DOF on the explored body), `src/scene/SceneRoot.tsx`.

**Behaviour (spec §3.4, §6):**
- Whole → target view animates `progress` 0→1 in 1.2 s (ease in-out) via `useExploreTransition`; reduced motion jumps. Leaving animates to 0 then calls the restore (camera, rings, rotation, dimming) — a leave while moving reverses from the current progress (Review Focus 1).
- Exploded: the outer shell (the body's own material) and each layer shell move by `explodeOffsets` along the camera's up vector captured at entry; each layer is a sphere at its drawn radius cut to a hemisphere-plus-rim so the inner layers show; bands render as a soft gradient in the material.
- Half-section: a clip plane through the centre, facing the camera at the moment the view is chosen (and again on each `sectionSeq` bump), fixed to the body afterwards; cut faces are discs coloured per layer with thin boundary lines.
- Body rotation frozen at entry (orientation used for the outer shell is the one at entry); other bodies' materials fade to 25 % (uniform), their labels hidden; orbit lines hidden.
- Interior colours from `interiorPalette(state, depthFraction, kind)`: rocky crust/mantle earth tones, liquid metal glowing amber, solid inner core near white, plasma orange→white, hydrogen layers blue→violet; emissive so the cut reads on the night side. Labelled illustrative (Task 7 shows the tag).
- [ ] **Step 1: failing tests** (pure parts): `interiorPalette` returns the documented ramps (state → hue family, deeper → brighter); `useExploreTransition`'s stepping function (pure helper) reverses from mid-progress; ring visibility helper hides rings when `progress > 0`.
- [ ] **Step 2–4:** RED → implement → GREEN. Then a scratch screenshot loop (not committed: scratchpad) for Earth Exploded and Half-section, Jupiter Half-section, the Sun Exploded, the Moon Half-section at `/?pause=1&target=<id>&explore=1&view=<v>&quality=high&fx=1`; look at each and refine.
- [ ] **Step 5:** `npm test`, `npm run typecheck`, `npx playwright test e2e/app.spec.ts e2e/golden.spec.ts -g "1-earth|2-saturn|3-sun"` (no regression outside Explore) — PASS. Commit · `feat(scene): interior cutaway rendering, transitions, ring hiding, dimming and camera framing`.

### Task 7: Explore overlay, floating labels and layer card

**Files:** Create `src/ui/explore/ExploreOverlay.tsx` (+ test), `src/ui/explore/LayerCard.tsx` (+ test), `src/ui/explore/labelLayout.ts` (+ test), `src/scene/interior/InteriorLabels.tsx`; styles in `src/styles/` (follow the existing glass tokens). Modify `src/App.tsx` (render the overlay while active).

**Behaviour (spec §3.3):**
- Top centre segmented switch Whole · Exploded · Half-section (`role="radiogroup"`, names "Whole", "Exploded", "Half-section"); top left "EXPLORE · INTERIOR" and the body name in its accent colour; top right ✕ ("Leave Explore"); an "Estimate" tag when any layer is `estimate`, "Illustrative colours" note link to the card.
- Floating labels: one per layer, anchored to a point on the layer (projected each frame by `InteriorLabels` in the scene, rendered into the label layer), leader lines; text = name · state · cited bound · `[n]`, or "Estimate" / "Illustrative size". `labelLayout(anchors, viewport, reserved)` places labels left/right of the body, never overlapping each other, the top bar or the bottom strip; on conflict the lower-priority label collapses to its name (selected layer has top priority). Phone (≤ 720 px): numbered dots plus a tap-to-open list.
- Bottom strip: `compositionPreview` + "Open full chart ›" → slides up a glass panel with `CompositionChart`; ✕ or Esc closes it.
- Layer card: click a layer (mesh raycast in Task 6's model) or its label → `selectLayer`; card shows bounds as stated (reuse the M2b.1 drawer formatting), state, composition text, uncertainty, estimate/illustrative notes and citations; click empty space clears.
- [ ] **Step 1: failing tests** — overlay renders the switch, ✕ and tag; clicking ✕ leaves; `labelLayout` with 4 anchors at 1280×720 and 390×844 yields no overlaps with each other or with the reserved rects (Review Focus 4); collapse rule keeps the selected label full; the card shows "Estimate" for an estimate layer.
- [ ] **Step 2–4:** RED → implement → GREEN; `npm run typecheck`.
- [ ] **Step 5:** scratch screenshots at 1280×720 and 390×844 for Earth and Jupiter; look; refine. Commit · `feat(explore): overlay, floating layer labels, layer card and composition panel`.

### Task 8: End-to-end and golden views

**Files:** Create `e2e/explore.spec.ts`. Modify `e2e/golden.spec.ts`, `e2e/layout.spec.ts`.
- `explore.spec.ts`: enter by button and by X; switch views by switch and keys; open and close the chart; Esc order; leave restores the header and the play state; `explore=1&view=section` loads directly; no page errors; Moon and Sun open.
- `layout.spec.ts`: in Explore at the five viewports, the top bar, labels and bottom strip do not intersect and the page does not scroll.
- Golden views (spec §7): `7-earth-exploded`, `7b-earth-section`, `7c-jupiter-section`, `7d-sun-exploded`, `7e-moon-section`, `7f-phone-earth-exploded`. Look at each against spec §6; refine shading values; record each tuned value as a ruling.
- Full `npx playwright test` — PASS.
- [ ] Commit · `test(explore): end-to-end, layout and golden views for Explore`.

### Task 9: Docs, vault and finish
- Architecture notes (core: interior geometry; pipeline: paper sources; scene: interior; ui: Explore overlay, chart, keys; state: exploreStore), ADR 0009, Data Sources note "Peer-reviewed papers (interior estimates)" listing each paper, carry-over "From M2b.3", Changelog, Home, Start here §6, session note, this plan's Execution record (rulings, deferred minors, research log, tuned values, goldens in `Assets/m2b3/`), README (Explore, keys, URL parameters), docs/SETUP.md if commands changed.
- `npm test`, `npm run typecheck` — PASS. Commit · `docs: M2b.3 Explore mode (architecture, ADR 0009, sources, changelog, session)`.
- Then the whole-branch review on the most capable model, one fix wave, one scoped re-review. Push and open the stacked PR (base `cloud-setup`) only when the user asks.

---

## Execution record

Built 2026-10-30 to 2026-11-06, subagent-driven on branch `m2b3-explore` (base `e6c8108`, on `cloud-setup` b1b148c). Implementers: sonnet, with opus for Task 6 (rendering) and Task 8 (visual tuning). Per-task reviews by sonnet; every task finished review-clean. The whole-branch review is done, with one fix wave (see the end of this record). Nothing is pushed and no PR is open.

- 2026-10-30: plan written after the user approved the spec ("yes go ahead … immediately continue with implementation").

### Commits by task
Order of execution: 1, 3, 2, 4, 5, 6, 7, 8, 9 (ruling R1).

| Task | Commits | What |
|---|---|---|
| 1 | `e6c8108..89e74ee` | Explore state, button, keys, URL parameters, AppChrome |
| 3 | `89e74ee..6ccf241` | paper sources, estimate and illustrative layers, ADR 0009 |
| 2 | `6ccf241..8cccfda` | interior geometry |
| 4 | `8cccfda..d8fabc5` | interiors of Venus and the giants (research) |
| 5 | `d8fabc5..edd915f` | composition chart |
| 6 | `edd915f..f7e38b2` | interior rendering, transitions, camera, dimming |
| 7 | `f7e38b2..4c04e2c` | overlay, floating labels, layer card |
| 8 | `4c04e2c..9fd7281` | end-to-end tests, goldens, tuning, fix rounds |
| 9 | after `9fd7281` | this documentation |

### Rulings
Each with its cost if wrong.
- **R1.** Execute Task 3 before Task 2: Task 2's geometry consumes the schema fields Task 3 adds. Cost: none.
- **R2.** Task 6 publishes the per-layer transform for the current frame in FrameState (`frame.explore`), and Task 7's labels read it. One source of truth. Cost: labels lag the layers by a frame.
- **R3.** An all-illustrative interior is allowed (layers share the radius evenly). Cost: an interior drawn with no numbers, clearly tagged.
- **Task 1:** drop the plan's `aria-pressed=false` on the Explore button (it is an action, not a toggle) and add `aria-keyshortcuts="X"`. A plan error. Cost: none.
- **Task 3:** `TRUSTED_JOURNALS` uses canonical full titles with an alias table (`JGR Planets` becomes "Journal of Geophysical Research: Planets"; "&" and "and" normalised); `publisher` is the canonical title. Cost: none.
- **Task 4:** keep Shah et al. 2022 "core size 2930-4350 km" as the Venus core radius range (the paper uses size and radius interchangeably; a diameter that large is impossible). Add `quoteUrl` https://arxiv.org/abs/2112.03225 and record this as a documented exception to README rule 6. Cost: Venus's core drawn twice too large (impossible, so not plausible).
- **Task 6:** an Explore URL frames the body at 3.4 radii and ignores `dist` (Explore framing wins). Cost: goldens cannot set the distance in Explore.
- **Task 6:** accept the Half-section face yawed 45 degrees from facing the camera (`SECTION_YAW_RAD`), tuned on screenshots to keep a crescent of the real surface visible; noted in the spec (§11). Cost: the cut face is seen at an angle.
- **Task 7:** accept the UI wording table (`interiorText.ts`) for "about" and "(global average)" now. Log as debt: move the qualifier into the data (a field filled and checked by the pipeline). Faithful today. Cost: the table drifts if layer ids change.
- **Task 9:** the documentation task had no review of its own; its notes were reviewed inside the whole-branch review (findings 12 and 14 corrected them). Cost: doc slips surface one review later.
- **Task 8:** the interior saturation push keeps a bounded negative, `max(x, -0.25 * luma)`, instead of a zero clamp. A zero clamp returns the pastel look: AgX needs blue below zero for amber. **Open for the user:** check on a real GPU for dark fringes. Cost: faint dark halos around hot layers on some GPUs.

### Tuned values (Task 8, visual loop at 1280 x 720 and 390 x 844)
- **Exploded spacing** (`core/interior/geometry.ts`): `EXPLODE_REVEAL` 0.8, `EXPLODE_MARGIN` 0.08, `EXPLODE_MAX` 1.8 (was a flat 0.3 step, capped at 0.8). Earth's offsets are 1.66, 0.79, 0.27 and 0 R (were 0.8, 0.53, 0.27, 0). Cost if wrong: a taller model, smaller on screen.
- **Camera fit** (`camera/explore.ts`): `EXPLORE_FIT_HALF_HEIGHT` 1.05 (1.2 left the core touching the bottom strip). The camera steps back by `halfHeight / 1.05 * 3.4 / entry distance`, never less than 1, following the eased progress. `ExploreFrame` gained `halfHeightRadii`. A phone, framed from about 5.6 R, does not step back.
- **Saturation push** (`INTERIOR_LOOK.saturation` 0.5): emission = luma + (c - luma) * (1 + 0.5 * min(glow, 1)). Hot layers get up to x1.5; cool rock (glow 0.2 to 0.55) x1.1 to x1.28. Why: AgX desaturates, and even pure `#f06a0e` at the shader's emission comes out terracotta. **Bound** `negativeFloor` 0.25. At that bound the outer core is `#d07604`, against `#d17500` unbounded and `#cf7748` clamped at zero.
- **Ramps** (`interiorPalette.ts`): rock `#8f4a26 / #b8622e / #d8823e`; liquid metal `#e8640a / #f58212 / #ffab2e`; solid core `#fff0d8 / #fffaf2` with glow 3.4 to 4.2 (was 2.2 to 2.8); plasma `#ff5a10 / #ff9a20 (0.45) / #ffd070 (0.8) / #fff4d8`; hydrogen deep stops `#9356e6 (0.8) / #c9a6ff (1)`. Crust and ices unchanged.
- **Boundary lines** capped at glow 2.2, so the brighter inner core does not draw a glaring ring.
- **Glare** (`exploreGlareKeep` in `sunFx.ts`): the flare and god rays fade with the focus of any Explore session. The Sun stays dimmed to 25 %. The bloom cut and the exposure floor stay the Sun's own.
- **Goldens:** reduced motion for the `7*` views plus explicit waits (scene signal, label opacity, `getAnimations()`), because SwiftShader at High renders a frame every few seconds and CSS fades were caught half-way. The camera uses the URL's default direction (no `az` or `el`).
- **Earlier values (Task 6, not changed since):** open time 1.2 s, focus time 0.6 s, dimming 25 %, Sun bloom 0.35, Sun exposure floor 0.8, Sun plasma gain 2.4, Explore camera tilt -22 degrees, distance limits 1.2 to 9 R.

### Goldens
Eight views (six from Task 8, two from the review fix wave), `quality=high&fx=1`, reduced motion, in `Assets/m2b3/`. After the bounded-negative fix the six were re-shot; the mean pixel difference from the first reviewed set was 0.22, 0.42, 0.04, 1.61, 0.03 and 0.62, in the order below.

**7 Earth Exploded.** Cap with real imagery, rust mantle, amber outer core, white-hot inner core, four labels (mockup B).
![[7-earth-exploded.png]]

**7b Earth Half-section.** Clean rings, a crescent of Earth on the left (mockup C).
![[7b-earth-section.png]]

**7c Jupiter Half-section.** Blue, indigo, violet; the Estimate tag.
![[7c-jupiter-section.png]]

**7d Sun Exploded.** Granulated photosphere cap, orange convection rim, amber radiative dome, pale-gold core; no corona, flare or rays.
![[7d-sun-exploded.png]]

**7e Moon Half-section.** Grey crescent, rust mantle, amber core; the exosphere strip with upper limits.
![[7e-moon-section.png]]

**7f Phone Earth Exploded (390 x 844).** The whole stack in frame, four numbered dots, the Layers button and the strip clear.
![[7f-phone-earth-exploded.png]]

**7g Saturn Half-section (review fix wave).** Pale crescent with no black band (filled while open), blue envelope, the metallic hydrogen fading into the diffuse core with no line, the depth ruler (≈ 23,300 km, Estimate; 58,232 km centre).
![[7g-saturn-section.png]]

**7h Uranus Exploded (review fix wave).** Pale north cap, blue envelope ring, teal mantle dome, pale core, stacked along the view's vertical; "Layer sizes are not to scale".
![[7h-uranus-exploded.png]]

After the fix wave all eight were re-shot: 7b, 7c and 7e now show the depth ruler, and their right-side labels sit below the centre.

Mockups from the design talk: `mockup-1-cutaway-styles.png`, `mockup-2-composition-styles.png`, `mockup-3-explore-layouts.png`. All ten bodies in both views were looked at in the review fix wave's screenshot loop (rounds r0 to r3).

### Tests
- Unit: 988 tests in 110 files; `npm run typecheck` clean.
- Full Playwright run (before the Task 8 fix rounds): 118 passed, 0 failed, 14.7 min. The first run had one failure, the `app.spec.ts` citation-highlight timing flake (fixed in the test; the app is unchanged).
- After the fix rounds: 25 targeted tests passed (`e2e/explore.spec.ts`, the Explore layout cases, the `7*` goldens). The full run was not repeated.
- New end-to-end: `e2e/explore.spec.ts` (9 tests), `e2e/layout.spec.ts` (+10 Explore cases at the five viewports), `e2e/golden.spec.ts` (+6). The leave-while-opening test compares the scene (interface hidden) with the frame before Explore: diff 0.006 to 0.007 against idle noise 0.002 to 0.003.

### Research log (Task 4)
The exact sentences of the kept papers are in [[Peer-reviewed papers (interior estimates)]]. This is the full record of what was tried.

Kept (four papers):
- **Maia and Wieczorek 2022**, JGR Planets, 10.1029/2021JE007004, open copy arXiv 2202.06971: Venus crust 20 km (global average if the plateaus are in Airy isostasy; uncertain).
- **Shah et al. 2022**, The Astrophysical Journal, 10.3847/1538-4357/ac410d, open copy arXiv 2112.03225: Venus core "size" 2930 to 4350 km, recorded as radius (documented exception, ruling above).
- **Militzer et al. 2022** (Juno), The Planetary Science Journal, 10.3847/PSJ/ac7ec8, quoted on the DOI page: Jupiter dilute core to 63 % of the radius.
- **Mankovich and Fuller 2021**, Nature Astronomy, 10.1038/s41550-021-01448-3, open copy arXiv 2104.13385: Saturn diffuse core to about 60 % of the radius.

Rejected:
- Liu et al. 2019 (Nature, Jupiter's diluted core by a giant impact): "nearly half" with no digit or percent, and a formation model.
- Wahl et al. 2017 (GRL): "a significant fraction of the planet's radius"; Wiley 403.
- Debras and Chabrier 2019, Miguel et al. 2022, Howard et al. 2023 ("20% of Jupiter's mass"), Helled 2022 (Icarus; "30% of the mass"), Stevenson 2020: no radius number in the abstract.
- Nettelmann et al. 2021 (arXiv 2110.15452): "0.4 RSat" is a fraction without a percent or unit; Mankovich and Fuller is better.
- Saturn ring seismology (Fuller 2014, Mankovich 2019, Dewberry 2021) and Mankovich and Fuller 2023 ("perhaps out to around one-half"): no usable number.
- Margot et al. 2021 (Nature Astronomy, Venus spin state): "a rough estimate of the size of the core"; cookie gate.
- Dumoulin et al. 2017 (JGR Planets): core radius "2900 to 3450 km", narrower than Shah, but Wiley 403 and no open copy; ADS 405.
- James et al. 2013 (JGR Planets): crust "8-25 km"; Wiley 403, no open copy.
- Uranus and Neptune: Helled 2011, Neuenschwander and Helled 2022 (MNRAS, not trusted), Morf et al. 2025 (dynamo-region limits only), Helled 2020 (Phil Trans, not trusted), Nettelmann 2013, arXiv 2412.06010 and 2408.10336, Neuenschwander et al. A&A 706 A170 (discontinuities "around 0.65 for Uranus and 0.7 for Neptune", no unit; using it would be interpretation). Left illustrative.
- Not used by rule: Oxford Research Encyclopedia, EGU and EPSC abstracts, Phil Trans.

Notes: the pipeline's user agent gets 403 from Wiley and a cookie gate from Nature, so papers on those hosts need an arXiv or PubMed Central copy. Saturn's discovery source id was aliased by URL (`nasa-science-saturn-facts-history` to `nasa-science-saturn-facts`). Uranus and Neptune show "Layer sizes are not to scale".

### Notes and carried items
- Task 1: hidden-while-active has no App-level unit test (WebGL); Task 8's end-to-end covers it. Focus on entry and focus return were carried to Task 7 (done).
- Task 3: interior layer bounds are optional in the type; consumers must use `resolveLayerRanges`.
- Task 4: carried to Task 7: Saturn "about 60 %", Uranus and Neptune "Layer sizes are not to scale", Venus crust labelled a global average (all done).
- Task 6: carried to Task 7: AppChrome stays hidden until the body has closed; clicking empty space clears the layer; subscribe narrowly to `progress` (all done). Carried to Task 8: tune the 0.8 R lift cap, the framing and the pastel colours (done: 1.8 R, fit, saturation push); an end-to-end test for a leave mid-transition (done). A Saturn black equatorial stripe is in the source map.
- Task 7: portrait phones frame from about 5.6 R (commit `052955d`); the "about" and "(global average)" wording shows in the drawer too; CSS fade-ins were caught mid-way in SwiftShader screenshots (Task 8 used reduced motion and waits). Carried to Task 8: end-to-end for empty-click clearing and for the chrome staying hidden until the body closed (done).
- Task 8: carried to Task 9 (this record): the Task 8 rulings, the goldens and `frame.explore.halfHeightRadii`.

### Deferred minors
Grouped by theme in [[2026-10-05-m2a1-carry-over]] ("From M2b.3"). By task, as the ledger recorded them:
- **Task 1:** the Explore button shows for every body (Task 7 added the "No interior data yet" state).
- **Task 3:** `quoteUrl` is host-checked only; `DOI_PATTERN` accepts any non-space tail; the drawer's "illustrative size" placeholder; `canonicalJournal` aliases on a plain object.
- **Task 2:** last layer not forced to the centre; tiny innermost layer flagged thickened; an infinite radius collapses to the floor.
- **Task 4:** Jupiter's illustrative metallic hydrogen sits outside NASA's "perhaps halfway"; the Venus crust's outer 0 carries the crust quote; the fix commit carries `generatedAt`-only changes.
- **Task 5:** uncertainty formatting differs from the drawer; zero gases dropped untested; formula-name keys; missing tests (ties, decade boundary, hover, uncertainty column); tick thinning breakpoint; value column width; tooltip closes on focus to the `[n]` link; double quotes in `CompositionChart.tsx`.
- **Task 6:** `frame.exploreCamera` cleared only at restore; per-frame allocations; Sun bloom stays full when another body is explored; frozen orientation null on the first frame; string-based wrapper test.
- **Task 7:** per-frame rect reads and opacity writes; bridge fields set during render or stale; camera fit uses the entry aspect; chart dialog without `aria-modal` or a focus trap.
- **Task 8:** leave-test pixel threshold tight; `app.spec.ts` highlight check loosened; fixed 1,500 ms wait in `golden.spec.ts`.

### Interruptions
- **Session restart, 2026-11-06:** Task 6 had partial work (two failing test files, no commits). The user asked to "continue". The task was resumed and told to commit in steps (`0e6acd3`, `d84efad`, `f7e38b2`).
- **5-hour usage limit:** it interrupted Task 8 at about 01:00 on 2026-11-06. At 06:20 the wake-up the user had asked for fired and Task 8 resumed with its uncommitted progress intact; it committed a step commit first (`9da91ff`).

### Whole-branch review
Done 2026-11-14 on base `30d38da`. Controller rulings: build the depth ruler and the soft bands (no waiver); fix everything in one wave. One fix wave followed (implementer: opus).

**Findings and what changed**
1. *Half-section depth ruler missing* (spec §2, §6). Built: `ui/explore/depthRuler.ts` (`depthRulerTicks`, `placeRuler`), drawn by `InteriorLabels`, its rect reserved for the labels. Values are cited bounds as depths (radius bounds as the cited radius minus the bound; percent bounds approximate, "≈"); the centre is the new cited `interior.radiusKm`. Right-side Half-section labels anchor below the centre. Hidden at phone width.
2. *Dilute/diffuse cores drawn with hard edges* (spec §4.2). Built: a cited, quote-checked `gradual` on the layer (Jupiter: NASA facts sentence; Saturn: the paper's sentence), `GRADUAL_BAND` 0.12 R soft band on both sides, no line or shading step, the shell edge blended; the card says the soft edge is illustrative.
3. *No Explore state for missing, failed or loading details.* "Loading the interior…", "No interior data yet", "Could not load the interior." with Retry; no switch unless a view can open.
4. *Drawer showed paper sizes without "Estimate"* and a lowercase placeholder. Drawer rows carry the card's tags; an illustrative layer shows no extent.
5. *Most bodies never looked at in Explore.* Screenshot loop over all 10 bodies in both views (rounds r0 to r3). Fixed: Saturn's black equatorial map band and the Uranus and Neptune map streaks while open (`mapGaps.ts`, Explore only), the shading step at soft bands, a seam where cited bounds leave a small gap (Mars; drawn layers now tile the radius). New goldens: Saturn Half-section, Uranus Exploded.
6. *Phone rotation clipped the body.* `reframeDistanceKm`: the new shape's framing is a floor when it needs more room.
7. *Strip `[n]` links went nowhere.* Tooltips name the source; the chart panel lists its sources; a strip `[n]` opens the chart on its source.
8. *Esc with a card open left Explore.* Esc: chart, then card, then leave.
9. *Other bodies were pickable.* `bodyPickable`: none while Explore is on.
10. *Pan worked in Explore.* `exploreInput` drops it.
11. *AppChrome unmounted at once.* 200 ms fade out and in, inert while fading; cut under reduced motion.
12. *`interiorRadiusKm` comment.* Now matches the code (mean radius for the Sun and the Moon, else equatorial) and says why that is fine.
13. *`MAX_LAYERS` truncated silently.* `MAX_INTERIOR_LAYERS` 8 is a `checkDetails` rule.
14. *Docs.* Earth offsets 1.66; the leave test is a threshold, not pixel-equal; Mankovich and Fuller backs the extent, composition and gradual boundary, not the state; the Task 9 ruling (above); the spec's "Amended while building"; the session note's "Open for the user" (the Saturn arXiv quote check).
15. This record.

**Fix-wave rulings** (cost if wrong): surface "0 km" uncited (a definition); ruler depths derived from radius and percent bounds (a derived number on screen, cited to the bound and the radius); `interior.radiusKm` added to the data (one more field); ruler hidden at ≤ 720 px (no ruler on phones); right-side Half-section labels below the centre (they sit lower); `GRADUAL_BAND` 0.12 R illustrative; map gap fills in Explore only (normal views still show the no-data areas); reframe only when the new shape needs more room; chrome fade 200 ms (inert chrome in the DOM for 200 ms).

**Tests:** `npm test` 1,031 tests in 112 files (988 before the wave); typecheck clean. Full Playwright (122 tests): run 1 had 114 passed and 8 failed, run 2 had 119 passed and 3 failed; every failure passed on a rerun of the failed tests (`--last-failed`: 8 of 8, then 3 of 3). The failures were load, not code: tests whose first page was still on "Loading Solar System data…" after the 5 s canvas wait while three workers rendered High goldens (another process on the machine was using a lot of CPU), and the leave-while-opening test, whose sampler saw the body close within one frame under that load (it passes alone: restore diff 0.006 to 0.007 against noise 0.001 to 0.003). Goldens re-shot from run 2 and copied to `Assets/m2b3/` (six re-shot, two new).

**Scoped re-review (2026-11-15, opus, `30d38da..7ac7473`):** approved with minors. All 15 findings confirmed in the code; finding 7 was partly fixed (the ruler's `[n]` had no tooltip). Nothing critical or important. The controller fixed the minors in one commit:
- The `[n]` marks on the ruler and the floating labels name their source on hover. Ruling: a tooltip, not a link, because the ruler lets clicks through to the scene; a label's click opens the card, which lists and links the sources. *Cost if wrong:* a ruler source can be read but not followed without opening a layer card.
- `detailsSourceOrder` now includes `interior.radiusKm` and each `gradual` source (last, so no number moves). Before, they had a number only because other values cited the same sources.
- The chart panel's Sources list includes the chart note's source.
- The card of the layer above a gradual core says when that sentence comes from a research paper (Saturn; Jupiter's sentence is NASA's). Ruling: the sentence counts as the paper's when it cites the same source as the estimate layer's bounds, since the app's data does not carry the source kind. *Cost if wrong:* a future layer whose official source gives both a bound and the gradual sentence, yet is marked estimate, would get the line wrongly.
- Focus stays in the overlay when Retry or the card goes away.
- A ruler test title corrected.

Noted, not changed: a thickened crust's tick sits at the drawn (thicker) radius with the cited value (the card says "Drawn thicker than scale"); Saturn's tick spacing is about 3 % off linear (finding 12); Mars Half-section was not re-shot after the tiling fix.

**Final verification (2026-11-15):** `npm test` 1,033 tests in 112 files; typecheck clean. Full Playwright before the minor fixes: 121 of 122 passed in one pass; the one failure was the leave-while-opening test under load. After the minor fixes: `explore.spec.ts` and `layout.spec.ts` 60 of 60 (that test included), the eight Explore goldens 8 of 8.

Push and open the stacked PR (base `cloud-setup`) only when the user asks.
