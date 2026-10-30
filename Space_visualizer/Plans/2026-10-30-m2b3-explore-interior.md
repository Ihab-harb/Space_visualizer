---
title: M2b.3 Explore mode, interior cutaway and composition charts — Implementation Plan
date: 2026-10-30
status: in progress
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

Rulings, deferred findings, research results and measured numbers go here as tasks finish.

- 2026-10-30: plan written after the user approved the spec ("yes go ahead … immediately continue with implementation").
