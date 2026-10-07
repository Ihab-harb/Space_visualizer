---
title: M2a.3 Interface Redesign and Tour — Implementation Plan
date: 2026-10-07
status: awaiting review
milestone: M2a.3
tags: [plan, m2a]
---

# M2a.3 Interface Redesign and Tour Implementation Plan

Back to [[Home]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]] (§4, §5 Tour, §7) · Follows [[2026-10-05-m2a2-cinematic-effects-and-quality]] · Inputs: [[2026-10-05-m2a1-carry-over]]

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First, fix the two residuals the M2a.2 final review left open: Auto dropping to Low on start-up hitches, and god rays not masked by bodies. Then replace the M1 top bar, info panel and time bar with the spec §4 interface:
- a header with a headline, live stat chips and a cited narrative;
- a frosted-glass control panel;
- pill labels that declutter themselves;
- a bottom bar with a timeline scrubber and a Tour button;
- a facts & sources drawer, which becomes a bottom sheet on phones.

Add Tour mode and the Venus Magellan radar view.

**Architecture:**
- **UI state** lives in two small Zustand stores: `uiStore` (drawer, phone controls) and `tourStore`.
- **Shared pure modules feed the panels.** They are tested in isolation:
  - `liveStats` (live distances);
  - `citationModel` (one numbering for header and drawer);
  - `narrative` (sentences built only from cited facts);
  - `timeline` (scrubber mapping);
  - `labelLayout` (overlap resolution);
  - `tour` (stops and phases).
- **One keyboard module** owns every shortcut.
- **The camera system runs the tour** from a pure tour model and hands control back to Orbit on any user input.
- **The Venus radar** is a new official imagery layer, built by the existing texture pipeline and cited like the others.

**Tech Stack:** M2a.2 stack, plus the USGS Magellan C3-MDIR global mosaic (GeoTIFF) through the existing texture pipeline. No new runtime dependencies. The fonts are already installed: `@fontsource-variable/inter` and `@fontsource/jetbrains-mono`.

**Spec:** `Space_visualizer/Specs/2026-10-04-m2-cinematic-and-rich-bodies-design.md`. This plan covers §4 (interface redesign), §5's Tour mode, and the §7 end-to-end items for Tour, header/chips and the drawer. It also covers the "Must do at the start of M2a.3" section of `Space_visualizer/Plans/2026-10-05-m2a1-carry-over.md`.

## Scope rulings (decided while planning; executors must not undo them)

| Spec says | This plan does | Why |
|---|---|---|
| Control panel "Time" group (speeds, play/pause, reverse, scrubber) **and** a bottom bar with the date scrubber | All time controls live in the bottom bar: date, play/pause, reverse, speed, Now, go-to-date, the timeline scrubber and Tour. The control panel keeps View, Style, Scale, Quality and Camera effects | Two sets of the same controls would conflict. The bottom bar is where the spec puts the scrubber |
| Style: Realistic; Exhibit (from M2c) | The Style group shows Realistic (pressed) and Exhibit, disabled, with "Exhibit mode arrives in M2c" | Shows the coming option without a half-built mode |
| A "date and time scrubber" | An absolute timeline over 1800–2050, JPL's high-accuracy span, with 50-year ticks. Outside that span the thumb pins to the nearer end and the bar says to use Go to date | That span is where positions are accurate. Go to date still reaches −4712 to 9999 |
| Narrative "assembled from cited facts" | Template sentences filled only with catalogue facts and live values. Every number is a cited value; no free text | Keeps the every-value-cited rule. The existing NASA description stays in the drawer |
| Facts & sources drawer | Closed by default. Opened by the header's "Facts & sources" button, by **F**, or by clicking a citation in the header (it scrolls to that source). Close button inside. Becomes a bottom sheet under 720 px | The header carries the summary; the drawer is the reference |
| Pill label: dot, name, one live datum; "selected pill expands" | Collapsed: dot, NAME, distance from Earth in AU (Earth shows its distance from the Sun). Expanded (selected or hovered): adds light time. Each button's accessible name stays the body name | Matches the spec example "JUPITER · 4.96 AU · 52 min light". Keeps e2e and screen-reader names stable |
| "labels fade when bodies overlap" | A DOM pass at 10 Hz reads the label rectangles and keeps the highest-priority label in each overlap. Priority: selected, then hovered, then on-screen size. Hidden labels fade out over 200 ms | Measured rectangles are exact. 10 Hz keeps the layout cost small |
| Sky credit (M2a.1) floats over the scene | Moves into the bottom bar's footer line | Removes the overlap class of bugs fixed twice in M2a.1 and M2a.2 |
| Tour: "Sun, then each planet outward, then an overview … headline changes. Any user input exits" | Stops: the Sun, then the planets by semi-major axis, then the overview. Each stop flies for 5 s (eased log distance) and dwells for 7 s while orbiting at 4°/s. Each stop selects its body, so the header changes; the overview deselects. Any pointer, wheel, touch or key exits; **T** toggles. Under `prefers-reduced-motion`, flights are cuts. The tour never changes simulation time | Concrete and testable. The time behaviour is a choice the spec leaves open; keeping time untouched keeps positions honest |
| Venus Magellan radar view (moved here from M2a.1) | USGS "Venus Magellan Global C3-MDIR Mosaic 2025m" (public domain, equirectangular −180°…180°), as 1k/2k tiers through the texture pipeline, with an orientation check at Maxwell Montes. A drawer toggle "Show Magellan radar" swaps Venus's cloud deck for the radar mosaic, labelled "radar backscatter — not visible light", and hides Venus's atmosphere shell while on | Official source, verified on 2026-10-07 (170 MB GeoTIFF). The label keeps radar from being mistaken for a photograph |

## Global Constraints

- **All earlier constraints still hold**, from M1, M2a.1 and M2a.2:
  - every value is cited; the imagery rule applies (spec §2);
  - Windows PowerShell;
  - GLSL strings are ASCII-only;
  - log-depth chunks in every custom `ShaderMaterial`;
  - every material or geometry created in `useMemo` is disposed;
  - NaN-safe shaders;
  - the effects order and the rule that effects never alter data;
  - every commit message ends with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Layout** (spec §4): header top-left; control panel top-right (dark frosted glass); pill labels; bottom bar (date, scrubber, Tour); facts & sources drawer on the right.
- **Keyboard** (spec §4): 1, 2 and Esc as in M1; **T** Tour; **Q** cycles Quality; **E** toggles camera effects; **F** opens the drawer. Keys are ignored while typing (input, select, textarea, contentEditable), with Ctrl, Cmd or Alt held, and on auto-repeat.
- **Visual language** (spec §4):
  - dark frosted-glass panels with hairline borders;
  - Inter for text, a monospace face for numbers;
  - cyan for interaction, amber for warnings, per-body accent colours (`body.display.color`);
  - animated transitions (slide, fade, ticking numbers, headline crossfade) that respect `prefers-reduced-motion`.
- **Stable accessible names:** the drawer is `role="complementary"` named "Body information". Each pill label's accessible name is the body name. Controls keep their visible names ("Orbit", "Follow", "Readable", "True scale", "Auto…", "High", "Medium", "Low", "Camera effects", "Now", "Go").
- **Header and drawer share one citation numbering** (`citationModel`). Every number in the header carries its citation.
- **Golden views** force `quality=high&fx=1`; everyday e2e runs at `quality=low`. The Earth pixel guard, the leak test and the layout tests must keep passing. Update their selectors only where the redesign moves elements, and record each change.

## Review Focus

1. **Starting the Tour while things are in motion** must not leave the camera in a broken state. Examples: during a Follow view, mid-transition, or with time running fast. Any input must hand control back cleanly. Pinned by Task 9 unit tests on the tour state machine, plus e2e tests: **T** starts the tour and a key or click stops it; after the stop, dragging rotates the Orbit view.
2. **Header citations must match the drawer.** A header number that points to a different source than the drawer's same number breaks the every-value-cited rule. Pinned by a Task 4 unit test (`citationModel` yields one order for both) and a Task 6 e2e test (header citation 1 scrolls to drawer source 1).
3. **Labels must neither vanish nor all overlap.** The selected body's label must always show, and at most one label should show in a cluster such as the inner planets in the overview. Pinned by Task 8 unit tests on `resolveOverlaps`, and an e2e test that no two visible label rectangles intersect in the overview golden.
4. **The phone layout must stay usable.** Panels must never cover each other or the bottom bar, and the drawer must become a bottom sheet. Pinned by Task 11 `layout.spec.ts` checks at 390×844 and 1280×720 that the header, control panel, drawer and bottom bar never intersect, with the drawer open and closed.
5. **A mirrored or shifted Venus radar map.** Pinned by the Task 10 pipeline validation: the Maxwell Montes box (65.2°N, 3.3°E) must be radar-bright against the global mean.

## File Structure

```
src/render/autoQuality.ts              (modified) consecutive-only long frames; cooldown from first sample
src/render/EffectsStack.tsx, sunFx.ts  (modified) autoClear={false}; god-ray proxy 1.02 R
src/styles/tokens.css, app.css         (modified) glass tokens, new layout regions, motion
src/ui/hotkeys.ts                      pure key mapping + useHotkeys
src/ui/liveStats.ts                    pure: live distances and light time with their source
src/ui/citations.ts                    (modified) + citationModel (one numbering for header and drawer)
src/ui/narrative.ts                    pure: cited narrative sentences
src/ui/Header.tsx                      headline, stat chips, narrative, overview mode
src/ui/ControlPanel.tsx                glass control panel (replaces TopBar.tsx)
src/ui/FactsDrawer.tsx                 drawer (replaces InfoPanel.tsx); Imagery + Venus radar toggle
src/ui/timeline.ts                     pure: jd ↔ timeline fraction, ticks
src/ui/BottomBar.tsx                   date, time controls, scrubber, Tour, sky credit (replaces TimeBar.tsx, SkyCredit.tsx)
src/scene/labels/labelLayout.ts        pure: overlap resolution
src/ui/useLabelDeclutter.ts            10 Hz DOM pass applying label opacity
src/scene/BodyLabel.tsx                (modified) pill: dot, name, live datum, priority attributes
src/camera/tour.ts                     pure: stops, phases, stop poses
src/camera/CameraSystem.tsx            (modified) runs the tour; exits on input
src/ui/useTourExit.ts                  window pointer/wheel/touch listeners that stop the tour
src/state/uiStore.ts, tourStore.ts     UI and tour state
pipeline/textures/*                    (modified) Venus Magellan radar layer + Maxwell Montes check
src/scene/materials/VenusMaterial.tsx  (modified) radar view
e2e/interface.spec.ts                  header, drawer, Tour, labels
```

---

### Task 1: Auto: count only consecutive long frames, and start the cooldown at the first sample

**Files:**
- Modify: `src/render/autoQuality.ts`, `src/render/autoQuality.test.ts`, `Space_visualizer/Architecture/render.md`

**Interfaces:**
- Consumes: the existing `createAutoQuality`, `AUTO_QUALITY` and `resyncAuto` (M2a.2).
- Produces (behaviour):
  - The long-frame drop fires only on **consecutive** long frames: `longRunFrames` (3) in a row, **or** at least 2 in a row whose total exceeds `longWithinWindowMs` (1000 ms). Any normal frame resets the run.
  - A new controller starts its cooldown at its first sample (`lastChangeAt = first sample time`). So neither start-up nor Auto entry can drop within `cooldownMs`.
  - Single long frames are still ignored, and frames longer than the window are still pauses.

- [ ] **Step 1: Write the failing tests** (append to `src/render/autoQuality.test.ts`)

```ts
describe('Auto start-up hitches (M2a.2 residual)', () => {
  /** Real traces measured on the dev machine: two compile/upload hitches about 1 s apart with normal frames between. */
  function feed(c: ReturnType<typeof createAutoQuality>, frames: Array<[number, number]>): string[] {
    let t = 0;
    const out: string[] = [];
    for (const [ms, count] of frames) {
      for (let i = 0; i < count; i++) {
        t += ms;
        const next = c.sample(ms, t);
        if (next) out.push(next);
      }
    }
    return out;
  }
  it('does not drop for start-up hitches separated by normal frames', () => {
    const c = createAutoQuality('high');
    expect(feed(c, [[16.7, 30], [880, 1], [25, 40], [440, 1], [16.7, 600]])).toEqual([]);
    expect(c.level).toBe('high');
  });
  it('does not drop within the cooldown that starts at the first sample', () => {
    const c = createAutoQuality('high');
    expect(feed(c, [[400, 5]])).toEqual([]); // 2 s of consecutive long frames, inside the first 5 s
  });
  it('still drops on sustained long frames once the start-up cooldown is over', () => {
    const c = createAutoQuality('high');
    expect(feed(c, [[16.7, 330], [400, 4]])).toEqual(['low']); // ~5.5 s of normal frames, then 4 × 400 ms in a row
  });
  it('drops on two consecutive long frames totalling more than a second', () => {
    const c = createAutoQuality('high');
    expect(feed(c, [[16.7, 330], [600, 2]])).toEqual(['low']);
  });
});
```

Also re-check the existing M2a.2 C1 tests (steady 400 ms frames, 1 fps). They start at t = 0, so with the new start-up cooldown they now drop at about 5 s instead of about 1–2 s. Update their expectations to "drops to Low within 7 s", and record the change in the report.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/render/autoQuality.test.ts`
Expected: the first two new tests FAIL. The current rule drops to Low.

- [ ] **Step 3: Change the controller**

In `createAutoQuality`:
- When `startedAt` is first set, also set `lastChangeAt = nowMs`. The cooldown then covers start-up and Auto entry; `resyncAuto` creates a new controller on entry.
- Replace the `long`/`longMs` window logic with a consecutive run, reset on every normal frame:
```ts
  /** The current run of consecutive long frames (any normal frame resets it). */
  let longRunMs = 0;
  // in the long-frame branch:
      fastSince = null;
      longRun++;
      longRunMs += frameMs;
      const sustained = longRun >= config.longRunFrames || (longRun >= 2 && longRunMs > config.longWithinWindowMs);
      if (sustained && nowMs - lastChangeAt >= config.cooldownMs) return change('low', nowMs);
      return null;
  // in the normal-frame branch, before window.push:
      longRun = 0;
      longRunMs = 0;
```
- Reset `longRun` and `longRunMs` wherever the old code reset `long`: in `change()`, and on hidden or pause frames.
- Update the `AUTO_QUALITY` doc comment to say "consecutive".

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/render`, then `npm test`, `npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Verify on the real GPU and correct the docs**

Run `npm run perf -- -g "Auto settles"`, then load the app with `?quality=auto` in the perf config (or a scratch Playwright script in your scratchpad) three times. Record when `data-quality` changes. On this Intel UHD, Auto should still settle at Low through the median rule, not through a start-up drop in the first 5 s.

In `Space_visualizer/Architecture/render.md`:
- replace the sentence saying the long-frame rule "did not fire" with the measured behaviour;
- describe the consecutive-run rule and the start-up cooldown.

- [ ] **Step 6: Commit**

```powershell
git add src/render Space_visualizer/Architecture/render.md
git commit -m "fix(render): count only consecutive long frames and start Auto's cooldown at the first sample" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Mask god rays by bodies (composer autoClear off, proxy at 1.02 R)

**Files:**
- Modify: `src/render/EffectsStack.tsx` (composer `autoClear={false}`, comment), `src/render/sunFx.ts` (`PROXY_RADIUS_FACTOR = 1.02`), `e2e/golden.spec.ts` (partial-occlusion golden plus a luminance assertion), `Space_visualizer/Decisions/0007-tone-mapping-and-exposure.md`, `Space_visualizer/Architecture/render.md`, `Space_visualizer/Plans/2026-10-05-m2a1-carry-over.md`

**Interfaces:**
- Produces: `EffectComposer autoClear={false}`, and the god-ray proxy scaled to `PROXY_RADIUS_FACTOR × renderRadius` (1.02, previously 0.98).
- Produces: a new golden, `3d-sun-partial`, at `/?jd=2461317.5&pause=1&target=earth&dist=20000&azSun=180&el=18.6&quality=high&fx=1`. In this view the Sun sits partly behind Earth's limb. The test asserts that a patch on Earth's night side next to the limb is darker than a threshold, so no rays cross the planet.

Background, from the M2a.2 final review:
- `GodRaysEffect` copies the scene's depth into its light target, then draws the proxy against it.
- With the composer's default `autoClear`, three clears that depth first (`WebGLBackground` clears whenever `renderer.autoClear` is true), so bodies never mask the rays.
- The re-reviewer measured `autoClear={false}` plus a 1.02 R proxy with route patches:
  - rays over the occluding planet dropped from 2.3–3.8 grey levels to 0–0.3;
  - goldens differed by at most 7 grey levels;
  - there was no square artifact;
  - the GodRays warning disappeared.

- [ ] **Step 1: Add the failing golden assertion**

In `e2e/golden.spec.ts`, add `3d-sun-partial` to `VIEWS`, and add a test that loads the same URL. Then:
1. Wait for `data-textures-ready` and a short settle.
2. Screenshot the canvas.
3. Measure the mean luminance of a 24×24 patch on Earth's night side, just inside the limb, about 30 px from where the Sun is hidden. Choose the patch from the current render and document the coordinates in a comment.
4. Assert that the mean is below a threshold set from the fixed render. Start from about half the current, unfixed value, and record both numbers.

Run: `npx playwright test e2e/golden.spec.ts -g "sun-partial" --reporter=list`
Expected: FAIL. Rays currently cross the planet.

- [ ] **Step 2: Apply the fix**

- `EffectsStack.tsx`:
  - add `autoClear={false}` to `<EffectComposer>`;
  - replace the existing comment explaining why autoClear stayed on with the new reasoning (the copied depth must survive into the god-ray light pass);
  - note that R3F restores `gl.autoClear` after `composer.render`, and that the RenderPass clears itself.
- `sunFx.ts`: add `export const PROXY_RADIUS_FACTOR = 1.02;` and use it in place of `0.98`. The proxy now sits just outside the Sun's own mesh, so the Sun's depth no longer hides the proxy.

- [ ] **Step 3: Run the guard and the full suite**

Run: `npx playwright test --reporter=list`, `npm test`, `npm run typecheck`
Expected: all PASS, including:
- the new partial-occlusion assertion;
- the Earth guard;
- the leak test;
- the layout tests;
- every golden.

View `3-sun.png`, `3c-sun-far.png`, `3d-sun-partial.png` and `4-overview.png`. Check:
- there is no square artifact around the Sun;
- the rays still read in `3c`;
- no rays cross Earth in `3d`.

Copy the new and changed goldens to `Space_visualizer/Assets/m2a2-golden/`.

- [ ] **Step 4: Update the docs**

- **Decision 0007:** replace the "autoClear not adopted" paragraph. State the cause (cleared copied depth), the fix (autoClear off plus a 1.02 R proxy), and the measured numbers.
- **render.md:** update the god-ray proxy section; partial occlusion now works.
- **Carry-over note:** mark the god-ray masking item done, and the GodRays warning item done.

- [ ] **Step 5: Commit**

```powershell
git add src/render e2e/golden.spec.ts Space_visualizer
git commit -m "fix(render): mask god rays by bodies by keeping the copied depth (composer autoClear off, proxy at 1.02 R)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Design tokens, glass panel styles and one keyboard module

**Files:**
- Create: `src/ui/hotkeys.ts`, `src/ui/hotkeys.test.ts`, `src/state/uiStore.ts`, `src/state/tourStore.ts`, `src/state/uiStore.test.ts`
- Modify: `src/styles/tokens.css`, `src/styles/app.css` (glass utility), `src/ui/TopBar.tsx` (remove its key handler; Task 5 replaces the component), `src/App.tsx` (mount `useHotkeys`)

**Interfaces:**
- Produces (`uiStore.ts`): `useUiStore` with:
  - `drawerOpen: boolean` (default false), `setDrawerOpen(open)`, `toggleDrawer()`;
  - `controlsOpen: boolean` (default false; phone-only control panel toggle), `toggleControls()`;
  - `focusSource: string | null`, `revealSource(sourceId)`, which opens the drawer and sets `focusSource`; the drawer scrolls to it and clears it.
- Produces (`tourStore.ts`): `useTourStore` with:
  - `active: boolean` and `seq: number` (incremented on every start);
  - `start()`, `stop()`, `toggle()`.
- Produces (`hotkeys.ts`):
  - `type HotkeyAction = 'orbit' | 'follow' | 'tour' | 'quality' | 'effects' | 'drawer'`;
  - `hotkeyAction(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean; target: EventTarget | null }): HotkeyAction | null`;
  - `isTypingTarget(target): boolean`;
  - `useHotkeys(): void`, a window keydown handler that applies the actions. Any key except T stops an active tour before acting, and T toggles the tour.
- Produces (tokens): `--glass`, `--glass-strong`, `--hairline`, `--accent` (cyan `#5ad1ff`), `--warning` (amber `#ffb454`), `--shadow`, `--radius-lg`, `--ease`, `--dur-fast` (150 ms) and `--dur` (260 ms). Under `prefers-reduced-motion: reduce`, `--dur-fast` and `--dur` are `0ms`.
- Produces (CSS): a `.glass` utility, with frosted background, hairline border, blur and shadow.

- [ ] **Step 1: Write the failing tests**

`src/ui/hotkeys.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { hotkeyAction } from './hotkeys';

const key = (k: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean; target: EventTarget | null }> = {}) => ({
  key: k, ctrlKey: false, metaKey: false, altKey: false, repeat: false, target: document.body, ...extra,
});

describe('hotkeyAction (spec §4 keyboard)', () => {
  it('maps the spec keys', () => {
    expect(['1', '2', 'Escape', 't', 'T', 'q', 'E', 'f'].map((k) => hotkeyAction(key(k)))).toEqual(['orbit', 'follow', 'orbit', 'tour', 'tour', 'quality', 'effects', 'drawer']);
    expect(hotkeyAction(key('x'))).toBeNull();
  });
  it('ignores modifiers and auto-repeat', () => {
    expect(hotkeyAction(key('f', { ctrlKey: true }))).toBeNull();
    expect(hotkeyAction(key('e', { metaKey: true }))).toBeNull();
    expect(hotkeyAction(key('q', { altKey: true }))).toBeNull();
    expect(hotkeyAction(key('t', { repeat: true }))).toBeNull();
  });
  it('ignores keys while typing', () => {
    for (const tag of ['input', 'select', 'textarea']) {
      expect(hotkeyAction(key('f', { target: document.createElement(tag) }))).toBeNull();
    }
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    expect(hotkeyAction(key('t', { target: editable }))).toBeNull();
  });
});
```

`src/state/uiStore.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useTourStore } from './tourStore';
import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => useUiStore.setState({ drawerOpen: false, controlsOpen: false, focusSource: null }));
  it('reveals a source by opening the drawer', () => {
    useUiStore.getState().revealSource('nssdca-planetary-fact-sheet');
    expect(useUiStore.getState()).toMatchObject({ drawerOpen: true, focusSource: 'nssdca-planetary-fact-sheet' });
  });
  it('toggles the drawer and the phone controls', () => {
    useUiStore.getState().toggleDrawer();
    useUiStore.getState().toggleControls();
    expect(useUiStore.getState()).toMatchObject({ drawerOpen: true, controlsOpen: true });
  });
});

describe('tourStore', () => {
  beforeEach(() => useTourStore.setState({ active: false, seq: 0 }));
  it('counts starts and toggles', () => {
    useTourStore.getState().start();
    useTourStore.getState().toggle();
    useTourStore.getState().toggle();
    expect(useTourStore.getState()).toMatchObject({ active: true, seq: 2 });
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui/hotkeys.test.ts src/state/uiStore.test.ts`
Expected: FAIL (the modules are missing).

- [ ] **Step 3: Create the stores and the hotkey module**

`src/state/uiStore.ts`:
```ts
import { create } from 'zustand';

interface UiState {
  drawerOpen: boolean;
  /** Phone only: the control panel collapses behind a Controls button. */
  controlsOpen: boolean;
  /** A source the drawer should scroll to once open (set by header citations). */
  focusSource: string | null;
  setDrawerOpen(open: boolean): void;
  toggleDrawer(): void;
  toggleControls(): void;
  revealSource(sourceId: string): void;
  clearFocusSource(): void;
}

export const useUiStore = create<UiState>()((set) => ({
  drawerOpen: false,
  controlsOpen: false,
  focusSource: null,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  toggleControls: () => set((s) => ({ controlsOpen: !s.controlsOpen })),
  revealSource: (focusSource) => set({ drawerOpen: true, focusSource }),
  clearFocusSource: () => set({ focusSource: null }),
}));
```

`src/state/tourStore.ts`:
```ts
import { create } from 'zustand';

interface TourState {
  active: boolean;
  /** Incremented on every start, so the camera can tell a new tour from a running one. */
  seq: number;
  start(): void;
  stop(): void;
  toggle(): void;
}

export const useTourStore = create<TourState>()((set, get) => ({
  active: false,
  seq: 0,
  start: () => set((s) => ({ active: true, seq: s.seq + 1 })),
  stop: () => set({ active: false }),
  toggle: () => (get().active ? get().stop() : get().start()),
}));
```

`src/ui/hotkeys.ts`:
```ts
import { useEffect } from 'react';
import { useRenderStore } from '../state/renderStore';
import { useTourStore } from '../state/tourStore';
import { useUiStore } from '../state/uiStore';
import { useViewStore } from '../state/viewStore';

export type HotkeyAction = 'orbit' | 'follow' | 'tour' | 'quality' | 'effects' | 'drawer';

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable);
}

const KEYS: Record<string, HotkeyAction> = {
  '1': 'orbit', Escape: 'orbit', '2': 'follow', t: 'tour', T: 'tour', q: 'quality', Q: 'quality', e: 'effects', E: 'effects', f: 'drawer', F: 'drawer',
};

/** Spec §4 keyboard. Browser shortcuts (Ctrl/Cmd/Alt) and auto-repeat are never ours. */
export function hotkeyAction(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean; target: EventTarget | null }): HotkeyAction | null {
  if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  return KEYS[e.key] ?? null;
}

const MODIFIER_ONLY = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

export function useHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = hotkeyAction(e);
      const tour = useTourStore.getState();
      // Spec §5: any user input exits the tour (T toggles it instead).
      if (tour.active && action !== 'tour' && !MODIFIER_ONLY.has(e.key) && !isTypingTarget(e.target)) tour.stop();
      if (!action) return;
      if (action === 'orbit') useViewStore.getState().setView('orbit');
      else if (action === 'follow') useViewStore.getState().setView('follow');
      else if (action === 'tour') tour.toggle();
      else if (action === 'quality') useRenderStore.getState().cycleMode();
      else if (action === 'effects') useRenderStore.getState().toggleEffects();
      else if (action === 'drawer') useUiStore.getState().toggleDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
```

In `App.tsx`, call `useHotkeys()` at the top of `App`, before the early returns. Remove the key handler `useEffect` from `TopBar.tsx`, and move the Q and E handling there into `hotkeys.ts` as above. Then update `TopBar.test.tsx`:
- render `App`'s hotkeys by calling `useHotkeys` in a tiny wrapper component;
- or move the key tests to `hotkeys.test.ts` / a `useHotkeys` hook test.

Keep every existing key behaviour covered.

- [ ] **Step 4: Add the tokens and the glass utility**

Replace `src/styles/tokens.css` with:
```css
:root {
  color-scheme: dark;
  --bg: #03050b;
  --glass: rgba(10, 14, 26, 0.62);
  --glass-strong: rgba(8, 11, 21, 0.86);
  --hairline: rgba(170, 200, 255, 0.14);
  --panel: var(--glass-strong);
  --panel-border: var(--hairline);
  --text: #e9edf5;
  --text-muted: #8f99b0;
  --accent: #5ad1ff;
  --accent-soft: rgba(90, 209, 255, 0.16);
  --warning: #ffb454;
  --danger: #ff7a7a;
  --shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
  --font-ui: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', monospace;
  --radius: 10px;
  --radius-lg: 16px;
  --gap: 12px;
  --gutter: 16px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 150ms;
  --dur: 260ms;
}
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-fast: 0ms;
    --dur: 0ms;
  }
}
```
In `app.css`, add:
```css
.glass {
  background: var(--glass);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
}
.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```
Search `app.css` for the old `--accent` value's uses (focus rings, pressed buttons) and confirm they still read well with the cyan.

- [ ] **Step 5: Run the tests**

Run: `npm test`, `npm run typecheck`, `npx playwright test e2e/app.spec.ts e2e/quality.spec.ts --reporter=list`
Expected: all PASS. Keys 1, 2, Esc, Q and E behave as before.

- [ ] **Step 6: Commit**

```powershell
git add src
git commit -m "feat(ui): add glass design tokens, UI and tour stores, and one keyboard module with T and F" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Live stats, one citation numbering, cited narrative, and the header

**Files:**
- Create: `src/ui/liveStats.ts`, `src/ui/liveStats.test.ts`, `src/ui/narrative.ts`, `src/ui/narrative.test.ts`, `src/ui/Header.tsx`, `src/ui/Header.test.tsx`, `src/state/sceneStatsStore.ts`
- Modify: `src/ui/citations.ts` and `src/ui/citations.test.ts` (`citationModel`), `src/ui/InfoPanel.tsx` (use `liveStats` and `citationModel`; Task 6 replaces it), `src/ui/format.ts` and `src/ui/format.test.ts` (short formats), `src/App.tsx` (mount the Header), `src/styles/app.css`, `src/scene/SceneRoot.tsx` (publish bodies-in-view)

**Interfaces:**
- Produces (`liveStats.ts`):
  - `interface LiveStats { fromSunKm: number | null; fromEarthKm: number | null; lightTimeS: number | null; sourceId: string | null }`;
  - `liveStats(catalog, body, jdTdb): LiveStats`. The `sourceId` is the body's position model, or Earth's for a fixed body (the M1 rule). `lightTimeS` is light time from Earth.
- Produces (`citations.ts`): `citationModel(catalog, body): { order: string[]; numbers: Map<string, number>; liveSource: string | null }`, the one numbering used by the header and the drawer. It follows the M1 `citationOrder`, plus the live source.
- Produces (`format.ts`):
  - `formatAu(km): string`, e.g. `"4.96 AU"`, to 2 decimals (3 below 1 AU);
  - `formatLightTimeShort(s): string`, e.g. `"52 min"`, `"8.3 min"` or `"1.3 s"`;
  - `formatDuration(hours): string` (hours below 48 h, otherwise days);
  - `formatPeriodDays(days): string` (days below 730, otherwise years).
- Produces (`narrative.ts`):
  - `type NarrativePart = { kind: 'text'; text: string } | { kind: 'value'; text: string; sourceId: string }`;
  - `buildNarrative(body, stats): NarrativePart[]`, with 2–3 sentences. A sentence is dropped when a fact it needs is missing.
- Produces (`sceneStatsStore.ts`): `useSceneStatsStore` with `{ bodiesInView: number; setBodiesInView(n) }`. It is written at about 2 Hz from the scene: a body is in view when its projected position falls within NDC [−1, 1]² in front of the camera.
- Produces (`Header.tsx`): `Header({ catalog })`:
  - **With a selection:**
    - subtitle "Planet · 4.96 AU from Earth" in the muted style;
    - headline (body name) in `body.display.color`, crossfaded on change via `key`;
    - up to 4 stat chips (distance from Earth, light time, day length, mean temperature). Each is `.num` and cited, and is omitted when its value is missing;
    - the narrative, with value parts highlighted and cited;
    - buttons "Facts & sources (F)", "Centre view" (Orbit only) and "×" (deselect).
  - **Overview** (nothing selected): subtitle "Overview", headline "Solar System", and chips for the date (UTC), the scale mode and the bodies in view.
  - Clicking a citation calls `useUiStore.revealSource(sourceId)`.

- [ ] **Step 1: Write the failing tests**

`src/ui/liveStats.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { makeCatalogFiles } from '../test/fixtures';
import { liveStats } from './liveStats';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);

describe('liveStats', () => {
  it('gives distances from the Sun and Earth plus light time, cited to the position model', () => {
    const s = liveStats(catalog, catalog.bodyById.get('jupiter')!, 2451545);
    expect(s.fromSunKm).toBeGreaterThan(7e8);
    expect(s.fromEarthKm).toBeGreaterThan(5e8);
    expect(s.lightTimeS).toBeCloseTo(s.fromEarthKm! / 299792.458, 6);
    expect(s.sourceId).toBe('jpl-approx-pos');
  });
  it('has no distance to itself and cites Earth’s model for the fixed Sun', () => {
    expect(liveStats(catalog, catalog.bodyById.get('earth')!, 2451545).fromEarthKm).toBeNull();
    const sun = liveStats(catalog, catalog.bodyById.get('sun')!, 2451545);
    expect(sun.fromSunKm).toBeNull();
    expect(sun.sourceId).toBe('jpl-approx-pos');
  });
});
```

`src/ui/narrative.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Body } from '../core/catalog/schema';
import { makeEarth, makeJupiter, makeSun } from '../test/fixtures';
import { buildNarrative, type NarrativePart } from './narrative';

const text = (parts: NarrativePart[]) => parts.map((p) => p.text).join('');
const stats = { fromSunKm: 7.8e8, fromEarthKm: 6.3e8, lightTimeS: 2100, sourceId: 'jpl-approx-pos' };

describe('buildNarrative', () => {
  it('builds cited sentences from facts and live values only', () => {
    const parts = buildNarrative(makeJupiter(), stats);
    expect(text(parts)).toMatch(/Jupiter/);
    const values = parts.filter((p) => p.kind === 'value');
    expect(values.length).toBeGreaterThanOrEqual(3);
    for (const v of values) expect(v.kind === 'value' && v.sourceId.length > 0).toBe(true);
    expect(text(parts)).not.toMatch(/NaN|undefined/);
  });
  it('drops a sentence when its fact is missing', () => {
    const j = makeJupiter();
    const noTemp: Body = { ...j, facts: { ...j.facts, meanTemperatureC: undefined, lengthOfDayHours: undefined } };
    expect(text(buildNarrative(noTemp, stats))).not.toMatch(/temperature|day lasts/i);
  });
  it('describes Earth by its distance from the Sun, and the Sun by its distance from Earth', () => {
    expect(text(buildNarrative(makeEarth(), { ...stats, fromEarthKm: null, lightTimeS: null }))).toMatch(/from the Sun/);
    expect(text(buildNarrative(makeSun(), { ...stats, fromSunKm: null }))).toMatch(/from Earth/);
  });
});
```
(If a fixture lacks a fact the first test needs, extend the fixture with an NSSDCA-cited value. Check `src/test/fixtures.ts` first.)

Append to `src/ui/citations.test.ts`:
```ts
describe('citationModel', () => {
  it('numbers the live source after the body’s own sources, once', () => {
    const f = makeCatalogFiles();
    const catalog = createCatalog(f.regions, f.sources, [f.bodies]);
    const jupiter = catalog.bodyById.get('jupiter')!;
    const m = citationModel(catalog, jupiter);
    expect(m.order.slice(0, citationOrder(jupiter).length)).toEqual(citationOrder(jupiter));
    expect(new Set(m.order).size).toBe(m.order.length);
    expect(m.liveSource).toBe('jpl-approx-pos');
    expect(m.numbers.get(m.order[0]!)).toBe(1);
  });
});
```
(Add the imports for `createCatalog` and `makeCatalogFiles`.)

`src/ui/Header.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCatalog } from '../core/catalog/catalog';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useUiStore } from '../state/uiStore';
import { makeCatalogFiles } from '../test/fixtures';
import { Header } from './Header';

const f = makeCatalogFiles();
const catalog = createCatalog(f.regions, f.sources, [f.bodies]);

describe('Header', () => {
  beforeEach(() => {
    useTimeStore.setState({ jdTdb: 2451545, playing: false });
    useUiStore.setState({ drawerOpen: false, focusSource: null });
  });
  it('shows the overview when nothing is selected', () => {
    useSelectionStore.setState({ selectedId: null });
    render(<Header catalog={catalog} />);
    expect(screen.getByRole('heading', { name: 'Solar System' })).toBeInTheDocument();
    expect(screen.getByText(/Bodies in view/)).toBeInTheDocument();
  });
  it('shows the selected body with cited chips and narrative', () => {
    useSelectionStore.setState({ selectedId: 'jupiter' });
    render(<Header catalog={catalog} />);
    const header = screen.getByRole('banner', { name: 'Selected body' });
    expect(within(header).getByRole('heading', { name: 'Jupiter' })).toBeInTheDocument();
    expect(within(header).getByText('From Earth')).toBeInTheDocument();
    expect(within(header).getAllByRole('link', { name: /Source \d+/ }).length).toBeGreaterThanOrEqual(3);
  });
  it('opens the drawer at a source when a citation is clicked', async () => {
    useSelectionStore.setState({ selectedId: 'jupiter' });
    render(<Header catalog={catalog} />);
    await userEvent.click(screen.getAllByRole('link', { name: /Source \d+/ })[0]!);
    expect(useUiStore.getState().drawerOpen).toBe(true);
    expect(useUiStore.getState().focusSource).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui`
Expected: FAIL (the new modules are missing).

- [ ] **Step 3: Implement the pure modules**

`src/ui/liveStats.ts`: move `liveDistances` out of `InfoPanel.tsx` and extend it:
```ts
import type { Catalog } from '../core/catalog/catalog';
import type { Body } from '../core/catalog/schema';
import { bodyState } from '../core/ephemeris/state';
import { distance } from '../core/math/vec3';
import { SPEED_OF_LIGHT_KM_S } from '../core/units';

export interface LiveStats {
  fromSunKm: number | null;
  fromEarthKm: number | null;
  lightTimeS: number | null;
  /** The position model behind these values: the body's own, or Earth's when the body is fixed (the Sun). */
  sourceId: string | null;
}

export function liveStats(catalog: Catalog, body: Body, jdTdb: number): LiveStats {
  const position = bodyState(body, jdTdb).positionKm;
  const sun = catalog.bodies.find((b) => b.category === 'star');
  const earth = catalog.bodyById.get('earth');
  const fromSunKm = sun && sun.id !== body.id ? distance(position, bodyState(sun, jdTdb).positionKm) : null;
  const fromEarthKm = earth && earth.id !== body.id ? distance(position, bodyState(earth, jdTdb).positionKm) : null;
  const sourceId = body.orbit.type === 'planet-approx' ? body.orbit.sourceId : earth?.orbit.type === 'planet-approx' ? earth.orbit.sourceId : null;
  return { fromSunKm, fromEarthKm, lightTimeS: fromEarthKm === null ? null : fromEarthKm / SPEED_OF_LIGHT_KM_S, sourceId };
}
```

`citationModel` in `src/ui/citations.ts`:
```ts
export function citationModel(catalog: Catalog, body: Body): { order: string[]; numbers: Map<string, number>; liveSource: string | null } {
  const order = citationOrder(body);
  const earth = catalog.bodyById.get('earth');
  const liveSource = body.orbit.type === 'planet-approx' ? body.orbit.sourceId : earth?.orbit.type === 'planet-approx' ? earth.orbit.sourceId : null;
  if (liveSource && !order.includes(liveSource)) order.push(liveSource);
  return { order, numbers: citationNumbers(order), liveSource };
}
```
Then make `InfoPanel.tsx` use `citationModel` and `liveStats`, deleting its local copies.

In `src/ui/format.ts`, add the following (with tests in `format.test.ts` for each boundary: 1 AU, 48 h and 730 d):
```ts
export function formatAu(km: number): string {
  const au = km / AU_KM;
  return `${au < 1 ? au.toFixed(3) : au.toFixed(2)} AU`;
}
export function formatLightTimeShort(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const min = seconds / 60;
  return min < 10 ? `${min.toFixed(1)} min` : min < 120 ? `${Math.round(min)} min` : `${(min / 60).toFixed(1)} h`;
}
export function formatDuration(hours: number): string {
  const h = Math.abs(hours);
  return h < 48 ? `${formatNumber(Number(h.toFixed(1)))} hours` : `${formatNumber(Number((h / 24).toFixed(1)))} days`;
}
export function formatPeriodDays(days: number): string {
  return days < 730 ? `${formatNumber(Number(days.toFixed(1)))} days` : `${formatNumber(Number((days / 365.25).toFixed(2)))} years`;
}
```

`src/ui/narrative.ts`:
```ts
import type { Body } from '../core/catalog/schema';
import { formatAu, formatDuration, formatLightTimeShort, formatNumber, formatPeriodDays } from './format';
import type { LiveStats } from './liveStats';

export type NarrativePart = { kind: 'text'; text: string } | { kind: 'value'; text: string; sourceId: string };

const t = (text: string): NarrativePart => ({ kind: 'text', text });
const v = (text: string, sourceId: string): NarrativePart => ({ kind: 'value', text, sourceId });

/** Spec §4: 2-3 sentences built only from cited facts and live values; a sentence needing a missing fact is dropped. */
export function buildNarrative(body: Body, stats: LiveStats): NarrativePart[] {
  const f = body.facts;
  const sentences: NarrativePart[][] = [];
  if (body.category === 'star') {
    if (f.spectralType && f.meanRadiusKm) {
      sentences.push([t(`The ${body.name} is a `), v(String(f.spectralType.value), f.spectralType.sourceId), t(' star with a mean radius of '), v(`${formatNumber(Number(f.meanRadiusKm.value))} km`, f.meanRadiusKm.sourceId), t('. ')]);
    }
  } else if (f.orbitalPeriodDays && f.semiMajorAxisAu) {
    sentences.push([t(`${body.name} circles the Sun every `), v(formatPeriodDays(Number(f.orbitalPeriodDays.value)), f.orbitalPeriodDays.sourceId), t(' at an average '), v(`${Number(f.semiMajorAxisAu.value).toFixed(2)} AU`, f.semiMajorAxisAu.sourceId), t('. ')]);
  }
  const day = f.lengthOfDayHours;
  const temp = f.meanTemperatureC;
  if (day && temp) {
    sentences.push([t('A day lasts '), v(formatDuration(Number(day.value)), day.sourceId), t(' and the mean temperature is '), v(`${formatNumber(Number(temp.value))} °C`, temp.sourceId), t('. ')]);
  } else if (temp) {
    sentences.push([t('Its mean temperature is '), v(`${formatNumber(Number(temp.value))} °C`, temp.sourceId), t('. ')]);
  }
  if (stats.sourceId) {
    if (stats.fromEarthKm !== null && stats.lightTimeS !== null) {
      const light = body.category === 'star' ? 'sunlight' : 'its light';
      sentences.push([t('Right now it is '), v(formatAu(stats.fromEarthKm), stats.sourceId), t(` from Earth; ${light} takes `), v(formatLightTimeShort(stats.lightTimeS), stats.sourceId), t(' to reach us.')]);
    } else if (stats.fromSunKm !== null) {
      sentences.push([t(`Right now ${body.name} is `), v(formatAu(stats.fromSunKm), stats.sourceId), t(' from the Sun.')]);
    }
  }
  return sentences.slice(0, 3).flat();
}
```
Check the real fact value types in `src/core/catalog/schema.ts`. `FactValue.value` is `number | string | boolean`, so a numeric fact may need narrowing with `typeof … === 'number'` instead of `Number(...)`. Use whichever keeps the compiler strict.

- [ ] **Step 4: Implement `Header.tsx` and the bodies-in-view stat**

`src/state/sceneStatsStore.ts`:
```ts
import { create } from 'zustand';

interface SceneStats {
  bodiesInView: number;
  setBodiesInView(n: number): void;
}

export const useSceneStatsStore = create<SceneStats>()((set) => ({
  bodiesInView: 0,
  setBodiesInView: (bodiesInView) => set((s) => (s.bodiesInView === bodiesInView ? s : { bodiesInView })),
}));
```
In `SceneRoot.tsx`, add a small in-canvas component `BodiesInView`:
- run `useFrame` at priority 0 and accumulate time;
- every 0.5 s, count bodies whose camera-relative position (`frame.bodyPositionsKm` − `frame.cameraPositionKm`) projects inside NDC [−1, 1]² with view-space z < 0;
- call `setBodiesInView` with the count;
- use a preallocated `Vector3`.

`src/ui/Header.tsx`:
```tsx
import type { Catalog } from '../core/catalog/catalog';
import type { BodyCategory } from '../core/catalog/schema';
import { formatUtc } from '../core/time/format';
import { tdbToUtc } from '../core/time/timescales';
import { useSceneStatsStore } from '../state/sceneStatsStore';
import { useSelectionStore } from '../state/selectionStore';
import { useTimeStore } from '../state/timeStore';
import { useUiStore } from '../state/uiStore';
import { useViewStore } from '../state/viewStore';
import { citationModel } from './citations';
import { formatAu, formatDuration, formatLightTimeShort, formatNumber } from './format';
import { liveStats } from './liveStats';
import { buildNarrative } from './narrative';

const CATEGORY: Record<BodyCategory, string> = { star: 'Star', planet: 'Planet', 'dwarf-planet': 'Dwarf planet', moon: 'Moon', asteroid: 'Asteroid', comet: 'Comet', spacecraft: 'Spacecraft' };

export function Header({ catalog }: { catalog: Catalog }) {
  const selectedId = useSelectionStore((s) => s.selectedId);
  const select = useSelectionStore((s) => s.select);
  const jdTdb = useTimeStore((s) => s.jdTdb);
  const scaleMode = useViewStore((s) => s.scaleMode);
  const view = useViewStore((s) => s.view);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const inView = useSceneStatsStore((s) => s.bodiesInView);
  const revealSource = useUiStore((s) => s.revealSource);
  const toggleDrawer = useUiStore((s) => s.toggleDrawer);
  const body = selectedId ? catalog.bodyById.get(selectedId) : undefined;

  if (!body) {
    return (
      <header className="glass header" aria-label="Overview">
        <p className="header__subtitle">Overview</p>
        <h1 className="header__headline">Solar System</h1>
        <ul className="chips">
          <li className="chip"><span className="chip__label">Date (UTC)</span><span className="num">{formatUtc(tdbToUtc(jdTdb))}</span></li>
          <li className="chip"><span className="chip__label">Scale</span><span>{scaleMode === 'true' ? 'True scale' : 'Readable'}</span></li>
          <li className="chip"><span className="chip__label">Bodies in view</span><span className="num">{inView}</span></li>
        </ul>
      </header>
    );
  }

  const stats = liveStats(catalog, body, jdTdb);
  const { numbers } = citationModel(catalog, body);
  const cite = (sourceId: string) => (
    <sup className="cite">
      <a
        href={`#source-${sourceId}`}
        aria-label={`Source ${numbers.get(sourceId)}`}
        onClick={(e) => {
          e.preventDefault();
          revealSource(sourceId);
        }}
      >
        [{numbers.get(sourceId)}]
      </a>
    </sup>
  );
  const distanceKm = stats.fromEarthKm ?? stats.fromSunKm;
  const distanceLabel = stats.fromEarthKm !== null ? 'From Earth' : 'From the Sun';
  const day = body.facts.lengthOfDayHours;
  const temp = body.facts.meanTemperatureC;
  const narrative = buildNarrative(body, stats);

  return (
    <header className="glass header" aria-label="Selected body" style={{ ['--body-accent' as string]: body.display.color }}>
      <p className="header__subtitle">
        {CATEGORY[body.category]}
        {distanceKm !== null ? ` · ${formatAu(distanceKm)} ${stats.fromEarthKm !== null ? 'from Earth' : 'from the Sun'}` : ''}
      </p>
      <h1 key={body.id} className="header__headline">{body.name}</h1>
      <ul className="chips">
        {distanceKm !== null && stats.sourceId && (
          <li className="chip"><span className="chip__label">{distanceLabel}</span><span className="num">{formatAu(distanceKm)}</span>{cite(stats.sourceId)}</li>
        )}
        {stats.lightTimeS !== null && stats.sourceId && (
          <li className="chip"><span className="chip__label">Light time</span><span className="num">{formatLightTimeShort(stats.lightTimeS)}</span>{cite(stats.sourceId)}</li>
        )}
        {day && (
          <li className="chip"><span className="chip__label">Day length</span><span className="num">{formatDuration(Number(day.value))}</span>{cite(day.sourceId)}</li>
        )}
        {temp && (
          <li className="chip"><span className="chip__label">Mean temp.</span><span className="num">{formatNumber(Number(temp.value))} °C</span>{cite(temp.sourceId)}</li>
        )}
      </ul>
      <p className="header__narrative">
        {narrative.map((p, i) =>
          p.kind === 'text' ? <span key={i}>{p.text}</span> : (
            <span key={i}>
              <strong className="num">{p.text}</strong>
              {cite(p.sourceId)}
            </span>
          ),
        )}
      </p>
      <div className="header__actions">
        <button type="button" onClick={toggleDrawer} title="Facts & sources (key F)">Facts &amp; sources</button>
        {view === 'orbit' && <button type="button" onClick={() => requestFocus(body.id)}>Centre view</button>}
        <button type="button" aria-label="Deselect" onClick={() => select(null)}>×</button>
      </div>
    </header>
  );
}
```
The header is a `<header>` named "Selected body" or "Overview". In jsdom it has `role="banner"` only when it isn't nested in a landmark. If `getByRole('banner')` fails, query `getByLabelText` or `getByRole('region')`, and give the element `role="region"`. Keep the test's intent.

CSS (in `app.css`):
```css
.header {
  position: absolute;
  top: var(--gutter);
  left: var(--gutter);
  width: min(520px, calc(100vw - 2 * var(--gutter)));
  padding: 16px 18px;
  z-index: 3;
}
.header__subtitle { margin: 0; color: var(--text-muted); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
.header__headline {
  margin: 2px 0 10px;
  font-size: clamp(28px, 4vw, 44px);
  font-weight: 750;
  line-height: 1.05;
  color: var(--body-accent, var(--text));
  animation: headline-in var(--dur) var(--ease);
}
@keyframes headline-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; padding: 0; list-style: none; }
.chip { display: flex; align-items: baseline; gap: 6px; padding: 5px 10px; border: 1px solid var(--hairline); border-radius: 999px; background: rgba(255, 255, 255, 0.03); font-size: 13px; }
.chip__label { color: var(--text-muted); font-size: 11px; }
.header__narrative { margin: 0 0 12px; color: var(--text); font-size: 14px; line-height: 1.5; }
.header__narrative strong { color: var(--body-accent, var(--accent)); font-weight: 600; }
.header__actions { display: flex; gap: 8px; }
```
In `App.tsx`, render `<Header catalog={catalog} />` after `<SceneRoot>`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/ui`, `npm test`, `npm run typecheck`, `npx playwright test e2e/app.spec.ts --reporter=list`
Expected: all PASS. The old info panel still renders for now, and the header now appears next to it.

- [ ] **Step 6: Commit**

```powershell
git add src
git commit -m "feat(ui): add the header with live cited stat chips and a narrative built from cited facts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Glass control panel (replaces the top bar)

**Files:**
- Create: `src/ui/ControlPanel.tsx`, `src/ui/ControlPanel.test.tsx`
- Delete: `src/ui/TopBar.tsx`, `src/ui/TopBar.test.tsx` (move every still-relevant test into `ControlPanel.test.tsx`)
- Modify: `src/App.tsx`, `src/styles/app.css`, `e2e/layout.spec.ts`, `e2e/app.spec.ts`, `e2e/quality.spec.ts` (selectors only, where they referenced `.top-bar`)

**Interfaces:**
- Consumes: `useViewStore` (view, coRotate, scaleMode), `useRenderStore` (mode, level, effects), and `useUiStore.controlsOpen` / `toggleControls` (Task 3).
- Produces: `ControlPanel()`, a `<nav className="glass control-panel" aria-label="Controls">` placed top-right. It holds these groups, each a labelled `.segmented` group with key hints in its `title`:
  - **View:** Orbit, Follow; "Rotate with body" when following;
  - **Style:** Realistic (pressed); Exhibit, disabled, with the title "Exhibit mode arrives in M2c";
  - **Scale:** Readable, True scale;
  - **Quality:** Auto · level, High, Medium, Low;
  - **Camera effects:** a checkbox.
  
  A footer line reads `1/2 view · Q quality · E effects · F facts · T tour · drag/scroll to move`.
- Produces: the panel publishes its bottom edge as `--control-panel-bottom` on `document.documentElement` (ResizeObserver, cleaned up; same pattern as the M2a.2 `--top-bar-bottom`). The drawer (Task 6) sits below it. `--top-bar-bottom` is retired; update its consumers.
- Phone (≤720 px): the panel collapses to a "Controls" button, top-right; `controlsOpen` expands it as a dropdown below the button.

- [ ] **Step 1: Write the failing tests**

`src/ui/ControlPanel.test.tsx` (move the existing TopBar tests here, renaming the component, and add):
```tsx
  it('shows Style with Exhibit disabled until M2c', () => {
    render(<ControlPanel />);
    expect(screen.getByRole('button', { name: 'Realistic' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Exhibit' })).toBeDisabled();
  });
  it('publishes its bottom edge for the drawer', () => {
    const { unmount } = render(<ControlPanel />);
    expect(document.documentElement.style.getPropertyValue('--control-panel-bottom')).toMatch(/px$/);
    unmount();
    expect(document.documentElement.style.getPropertyValue('--control-panel-bottom')).toBe('');
  });
```
The key-handling tests now belong to `hotkeys.test.ts` (Task 3). Do not duplicate them here.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui/ControlPanel.test.tsx`
Expected: FAIL (the module is missing).

- [ ] **Step 3: Create `src/ui/ControlPanel.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import type { QualityLevel, QualityMode } from '../render/quality';
import { useRenderStore } from '../state/renderStore';
import { useUiStore } from '../state/uiStore';
import { useViewStore } from '../state/viewStore';

const MODE_LABEL: Record<QualityMode, string> = { auto: 'Auto', high: 'High', medium: 'Medium', low: 'Low' };
const LEVEL_LABEL: Record<QualityLevel, string> = { high: 'High', medium: 'Medium', low: 'Low' };

/** CSS custom property the drawer uses to sit below this panel, whose height grows when its controls wrap. */
export const CONTROL_PANEL_BOTTOM_VAR = '--control-panel-bottom';

export function ControlPanel() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const coRotate = useViewStore((s) => s.coRotate);
  const toggleCoRotate = useViewStore((s) => s.toggleCoRotate);
  const scaleMode = useViewStore((s) => s.scaleMode);
  const setScaleMode = useViewStore((s) => s.setScaleMode);
  const mode = useRenderStore((s) => s.mode);
  const level = useRenderStore((s) => s.level);
  const setMode = useRenderStore((s) => s.setMode);
  const effects = useRenderStore((s) => s.effects);
  const toggleEffects = useRenderStore((s) => s.toggleEffects);
  const controlsOpen = useUiStore((s) => s.controlsOpen);
  const toggleControls = useUiStore((s) => s.toggleControls);

  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const publish = () => root.setProperty(CONTROL_PANEL_BOTTOM_VAR, `${Math.round(el.getBoundingClientRect().bottom)}px`);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.removeProperty(CONTROL_PANEL_BOTTOM_VAR);
    };
  }, []);

  return (
    <nav ref={ref} className={controlsOpen ? 'glass control-panel is-open' : 'glass control-panel'} aria-label="Controls">
      <button type="button" className="control-panel__toggle" aria-expanded={controlsOpen} onClick={toggleControls}>
        Controls
      </button>
      <div className="control-panel__body">
        <div className="group">
          <span className="group__label">View</span>
          <div className="segmented" role="group" aria-label="Camera view">
            <button type="button" aria-pressed={view === 'orbit'} onClick={() => setView('orbit')} title="Rotate, zoom and pan around a point (key 1)">Orbit</button>
            <button type="button" aria-pressed={view === 'follow'} onClick={() => setView('follow')} title="Fly to the selected body and track it (key 2)">Follow</button>
          </div>
          {view === 'follow' && (
            <label className="toggle">
              <input type="checkbox" checked={coRotate} onChange={toggleCoRotate} />
              Rotate with body
            </label>
          )}
        </div>
        <div className="group">
          <span className="group__label">Style</span>
          <div className="segmented" role="group" aria-label="Style">
            <button type="button" aria-pressed="true" title="Official NASA/USGS/STScI imagery">Realistic</button>
            <button type="button" disabled title="Exhibit mode arrives in M2c">Exhibit</button>
          </div>
        </div>
        <div className="group">
          <span className="group__label">Scale</span>
          <div className="segmented" role="group" aria-label="Scale">
            <button type="button" aria-pressed={scaleMode === 'readable'} onClick={() => setScaleMode('readable')} title="Bodies never shrink below a few pixels">Readable</button>
            <button type="button" aria-pressed={scaleMode === 'true'} onClick={() => setScaleMode('true')} title="Real sizes; labels keep bodies findable">True scale</button>
          </div>
        </div>
        <div className="group">
          <span className="group__label">Quality</span>
          <div className="segmented" role="group" aria-label="Quality">
            {(['auto', 'high', 'medium', 'low'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} title="Rendering quality; Auto adapts to your frame rate (key Q cycles)">
                {m === 'auto' && mode === 'auto' ? `Auto · ${LEVEL_LABEL[level]}` : MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <label className="toggle" title="Bloom stays on; god rays, lens flare, depth of field, grain and the other camera effects switch off (key E)">
          <input type="checkbox" checked={effects} onChange={toggleEffects} />
          Camera effects
        </label>
        <p className="control-panel__hint">1/2 view · Q quality · E effects · F facts · T tour · drag, right-drag and scroll to move</p>
      </div>
    </nav>
  );
}
```

CSS. Replace the `.top-bar` rules with:
```css
.control-panel {
  position: absolute;
  top: var(--gutter);
  right: var(--gutter);
  z-index: 3;
  max-width: min(560px, calc(100vw - 2 * var(--gutter)));
  padding: 12px 14px;
}
.control-panel__body { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
.control-panel__toggle { display: none; }
.group { display: flex; align-items: center; gap: 8px; }
.group__label { color: var(--text-muted); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
.control-panel__hint { flex-basis: 100%; margin: 2px 0 0; color: var(--text-muted); font-size: 11px; }
@media (max-width: 720px) {
  .control-panel { padding: 6px; }
  .control-panel__toggle { display: inline-flex; }
  .control-panel__body { display: none; }
  .control-panel.is-open .control-panel__body { display: flex; flex-direction: column; align-items: flex-start; padding: 8px; }
}
```
Keep `.segmented` and `.toggle` (already in `app.css`). Restyle the pressed state: `aria-pressed="true"` gives a cyan border and `--accent-soft` background, and `button:disabled` gets opacity 0.45.

- [ ] **Step 4: Wire it up and move the dependents**

- `App.tsx`: render `<ControlPanel />` in place of `<TopBar />`.
- Delete `TopBar.tsx` and `TopBar.test.tsx`.
- In `app.css`, replace every `var(--top-bar-bottom…)` with `var(--control-panel-bottom…)`. In `e2e/layout.spec.ts`, replace `.top-bar` with `.control-panel`, and keep the intersection checks.
- `e2e/quality.spec.ts`: the Q/E key test still works through the hotkeys. Update any `.top-bar` selector.

- [ ] **Step 5: Run the tests**

Run: `npm test`, `npm run typecheck`, `npx playwright test --reporter=list`
Expected: all PASS. View `test-results/golden/1-earth-terminator.png` and `5-phone.png`. The header should be top-left and the control panel top-right; on the phone, a Controls button.

- [ ] **Step 6: Commit**

```powershell
git add -A src e2e
git commit -m "feat(ui): replace the top bar with a glass control panel (View, Style, Scale, Quality, Camera effects)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Facts & sources drawer (replaces the info panel)

**Files:**
- Create: `src/ui/FactsDrawer.tsx`
- Rename: `src/ui/InfoPanel.test.tsx` → `src/ui/FactsDrawer.test.tsx` (adapted)
- Delete: `src/ui/InfoPanel.tsx`
- Modify: `src/App.tsx`, `src/styles/app.css`, `e2e/app.spec.ts`, `e2e/layout.spec.ts`

**Interfaces:**
- Consumes:
  - `citationModel` and `liveStats` (Task 4);
  - `accuracyLines`, `imageryLines` and `illustrativeNotes` (M1/M2a.1);
  - `useUiStore` (`drawerOpen`, `setDrawerOpen`, `focusSource`, `clearFocusSource`).
- Produces: `FactsDrawer({ catalog })`, an `<aside role="complementary" aria-label="Body information" className="glass drawer">`. It contains the M1 info-panel content (the description and its citation, physical and orbit facts, "At the simulation time", Position accuracy, Imagery, Sources), using the same `citationModel` numbering as the header. Task 10 adds the Venus radar toggle inside its Imagery section.
- Behaviour:
  - The drawer is rendered only while a body is selected.
  - When it is closed it is still mounted, but slid off-screen (`transform: translateX(105%)`) and marked `aria-hidden="true"` and `inert`, so screen readers and Tab skip it. Opening it slides it in over `var(--dur)`.
  - A close button (`aria-label="Close facts"`) closes it, and Escape still switches the view as in M1.
  - When `focusSource` is set, it opens and scrolls `#source-<id>` into view, briefly highlights the entry (CSS class for 1.5 s), then clears `focusSource`.
  - **Phone (≤720 px):** it becomes a bottom sheet, spanning the full width, up to 70 vh tall, sliding up from the bottom bar.
- Sizing: `top: calc(var(--control-panel-bottom, 84px) + 8px)` and `bottom: calc(var(--bottom-bar-height, 150px) + 8px)`. Task 7 publishes `--bottom-bar-height`.

- [ ] **Step 1: Adapt and extend the tests**

Move `InfoPanel.test.tsx` to `FactsDrawer.test.tsx`, render `<FactsDrawer catalog={catalog} />`, and set `useUiStore.setState({ drawerOpen: true })` in `beforeEach`. All existing assertions must still hold (facts, citations, accuracy, imagery, sources). Add:
```tsx
  it('is hidden from assistive tech while closed', () => {
    useUiStore.setState({ drawerOpen: false });
    render(<FactsDrawer catalog={catalog} />);
    expect(screen.queryByRole('complementary', { name: 'Body information' })).toBeNull(); // aria-hidden removes it from the a11y tree
  });
  it('uses the same citation numbers as the header', () => {
    render(<FactsDrawer catalog={catalog} />);
    const { order } = citationModel(catalog, catalog.bodyById.get('jupiter')!);
    const items = within(panel()).getAllByRole('listitem').filter((li) => li.id.startsWith('source-'));
    expect(items.map((li) => li.id.replace('source-', ''))).toEqual(order.filter((id) => catalog.sources.has(id)));
  });
  it('scrolls to and clears a revealed source', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    useUiStore.setState({ drawerOpen: true, focusSource: 'nssdca-planetary-fact-sheet' });
    render(<FactsDrawer catalog={catalog} />);
    expect(scroll).toHaveBeenCalled();
    expect(useUiStore.getState().focusSource).toBeNull();
  });
```
(Import `vi`, `within`, `citationModel` and `useUiStore`.)

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui/FactsDrawer.test.tsx`
Expected: FAIL (the module is missing).

- [ ] **Step 3: Create `src/ui/FactsDrawer.tsx`**

Move the body of `InfoPanel.tsx` into `FactsDrawer`, with these changes:
- Wrap it in:
```tsx
  const open = useUiStore((s) => s.drawerOpen);
  const setOpen = useUiStore((s) => s.setDrawerOpen);
  const focusSource = useUiStore((s) => s.focusSource);
  const clearFocusSource = useUiStore((s) => s.clearFocusSource);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open || !focusSource) return;
    const el = ref.current?.querySelector<HTMLElement>(`#source-${CSS.escape(focusSource)}`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.add('is-highlighted');
      window.setTimeout(() => el.classList.remove('is-highlighted'), 1500);
    }
    clearFocusSource();
  }, [open, focusSource, clearFocusSource]);
```
  and return:
```tsx
    <aside ref={ref} className={open ? 'glass drawer is-open' : 'glass drawer'} aria-label="Body information" aria-hidden={!open} inert={!open} role="complementary">
```
- **Header row:** the body name (`h2`), the category line and a `Close facts` button that calls `setOpen(false)`. "Centre view" and "×" (deselect) now live in the Header (Task 4), so remove them from here.
- **Citations:** use `citationModel(catalog, body)` and `liveStats(catalog, body, jdTdb)` for numbering and live values.
- jsdom has no `CSS.escape`. Guard it with `typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id`. Source ids are kebab-case, so this is safe.
- React 19 types `inert` as a boolean attribute. If the types reject it, spread `{...(!open ? { inert: '' } : {})}` and record the adaptation.

CSS:
```css
.drawer {
  position: absolute;
  right: var(--gutter);
  top: calc(var(--control-panel-bottom, 84px) + 8px);
  bottom: calc(var(--bottom-bar-height, 150px) + 8px);
  width: min(380px, calc(100vw - 2 * var(--gutter)));
  overflow-y: auto;
  padding: 16px 18px;
  z-index: 4;
  transform: translateX(calc(100% + var(--gutter) + 8px));
  transition: transform var(--dur) var(--ease);
}
.drawer.is-open { transform: none; }
.sources li.is-highlighted { background: var(--accent-soft); border-radius: 6px; transition: background var(--dur) var(--ease); }
@media (max-width: 720px) {
  .drawer {
    left: 0; right: 0; width: auto; top: auto;
    bottom: var(--bottom-bar-height, 120px);
    max-height: 70vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    transform: translateY(105%);
  }
  .drawer.is-open { transform: none; }
}
```
Remove the old `.info-panel` positioning rules. Keep the content styles (`.facts`, `.cite`, `.sources`, `.tag`…), renamed where they used the `info-panel__` prefix, or leave the class names in place.

- [ ] **Step 4: Wire it up and update e2e**

- `App.tsx`: render `<FactsDrawer catalog={catalog} />` in place of `<InfoPanel …/>`. Delete `InfoPanel.tsx`.
- `e2e/app.spec.ts`: in the tests that open the panel ("shows cited information for a planet", "panels sit above scene labels", "cites the official imagery for Earth"), press **F** (or click the header's "Facts & sources") after selecting. Keep the assertions.
- Add an e2e test for Review Focus #2:
```ts
test('a header citation opens the drawer at the same source', async ({ page }) => {
  await page.goto('/?target=jupiter&pause=1&quality=low');
  const header = page.getByRole('banner', { name: 'Selected body' });
  const first = header.getByRole('link', { name: /Source \d+/ }).first();
  const label = await first.getAttribute('aria-label');
  await first.click();
  const drawer = page.getByRole('complementary', { name: 'Body information' });
  await expect(drawer).toBeVisible();
  const n = Number(label!.replace('Source ', ''));
  const item = drawer.locator('.sources li').nth(n - 1);
  await expect(item).toHaveClass(/is-highlighted/);
  await expect(item).toBeInViewport();
});
```
(If the header's role resolves differently in the browser, use the same locator strategy as the unit test.)
- `e2e/layout.spec.ts`: replace `.info-panel` with `.drawer`. Open it (F) before measuring, and keep the no-intersection checks against `.control-panel`.

- [ ] **Step 5: Run the tests**

Run: `npm test`, `npm run typecheck`, `npx playwright test --reporter=list`
Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add -A src e2e
git commit -m "feat(ui): turn the info panel into a facts & sources drawer that shares the header's citation numbers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Bottom bar: time controls, timeline scrubber, Tour button and sky credit

**Files:**
- Create: `src/ui/timeline.ts`, `src/ui/timeline.test.ts`, `src/ui/BottomBar.tsx`
- Rename: `src/ui/TimeBar.test.tsx` → `src/ui/BottomBar.test.tsx` (adapted)
- Delete: `src/ui/TimeBar.tsx`, `src/ui/SkyCredit.tsx`
- Modify: `src/App.tsx`, `src/styles/app.css`, `e2e/app.spec.ts`, `e2e/layout.spec.ts`

**Interfaces:**
- Produces (`timeline.ts`):
  - `TIMELINE_START_UTC = '1800-01-01'` and `TIMELINE_END_UTC = '2050-12-31'`, with `timelineRangeTdb(): { start: number; end: number }` (JD TDB, via `parseDateInput` + `utcToTdb`);
  - `fractionForJd(jdTdb): { fraction: number; outside: 'before' | 'after' | null }` (fraction clamped to 0–1);
  - `jdForFraction(fraction): number`;
  - `timelineTicks(): Array<{ year: number; fraction: number }>`, every 50 years from 1800 to 2050.
- Produces: `BottomBar({ catalog })`, a `<section className="glass bottom-bar" aria-label="Time controls">` containing:
  - **Row 1:** `<time aria-label="Simulation date">` (monospace, UTC), Reverse, Play/Pause, Speed select, Now, the Go to date form (unchanged behaviour and labels), and the Tour button (`aria-pressed` = tour active, `data-tour-toggle`, title "Guided tour (key T)").
  - **Row 2:** the timeline, an `<input type="range" aria-label="Timeline 1800–2050" min=0 max=1000>` with tick labels.
    - Dragging sets the date (`setJdTdb(jdForFraction(v/1000))`) without changing play state.
    - Outside the span, the thumb sits at the nearer end and a note reads "Outside 1800–2050 — use Go to date".
  - **Footer line:** the validity warning (`role="status"`, unchanged texts) and the sky credit ("Sky: Deep Star Maps 2020 — NASA Goddard Scientific Visualization Studio", a link from the source record).
- The bar publishes `--bottom-bar-height` (its height in px, via ResizeObserver) on `document.documentElement`.

- [ ] **Step 1: Write the failing tests**

`src/ui/timeline.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fractionForJd, jdForFraction, timelineRangeTdb, timelineTicks } from './timeline';

describe('timeline (JPL high-accuracy span 1800–2050)', () => {
  const { start, end } = timelineRangeTdb();
  it('maps the ends and round-trips', () => {
    expect(fractionForJd(start)).toEqual({ fraction: 0, outside: null });
    expect(fractionForJd(end).fraction).toBeCloseTo(1, 12);
    const mid = (start + end) / 2;
    expect(jdForFraction(fractionForJd(mid).fraction)).toBeCloseTo(mid, 6);
  });
  it('clamps and flags dates outside the span', () => {
    expect(fractionForJd(start - 1000)).toEqual({ fraction: 0, outside: 'before' });
    expect(fractionForJd(end + 1000)).toEqual({ fraction: 1, outside: 'after' });
  });
  it('labels every 50 years', () => {
    expect(timelineTicks().map((t) => t.year)).toEqual([1800, 1850, 1900, 1950, 2000, 2050]);
    expect(timelineTicks()[0]!.fraction).toBe(0);
  });
});
```

Adapt `BottomBar.test.tsx` (from `TimeBar.test.tsx`). Keep the play, speed, Now, go-to-date and warning tests, and add:
```tsx
  it('moves through time with the timeline without changing play state', async () => {
    useTimeStore.setState({ jdTdb: 2451545, playing: false });
    render(<BottomBar catalog={catalog} />);
    const slider = screen.getByRole('slider', { name: 'Timeline 1800–2050' });
    fireEvent.change(slider, { target: { value: '0' } });
    expect(useTimeStore.getState().jdTdb).toBeCloseTo(timelineRangeTdb().start, 6);
    expect(useTimeStore.getState().playing).toBe(false);
  });
  it('toggles the tour', async () => {
    useTourStore.setState({ active: false, seq: 0 });
    render(<BottomBar catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: /Tour/ }));
    expect(useTourStore.getState().active).toBe(true);
  });
  it('credits the sky imagery', () => {
    render(<BottomBar catalog={catalog} />);
    expect(screen.getByText(/Sky:/)).toBeInTheDocument();
  });
```
For the sky-credit test, the fixture catalogue needs the `nasa-svs-deep-star-maps` source and `useSkyStore` to hold its ref. Set `useSkyStore.setState({ ref: { tiers: { '2k': 'x' }, sourceId: 'nasa-svs-deep-star-maps' }, status: 'ready' })`, and add the source to `TEST_SOURCES` in the fixtures if it is missing.

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/ui/timeline.test.ts src/ui/BottomBar.test.tsx`
Expected: FAIL (the modules are missing).

- [ ] **Step 3: Implement `timeline.ts`**

```ts
import { parseDateInput } from '../core/time/format';
import { utcToTdb } from '../core/time/timescales';

/** JPL's high-accuracy span for the approximate planet elements (spec §5 accuracy note). */
export const TIMELINE_START_UTC = '1800-01-01';
export const TIMELINE_END_UTC = '2050-12-31';

const jd = (date: string) => {
  const p = parseDateInput(date);
  if (!p.ok) throw new Error(`bad timeline date ${date}`);
  return utcToTdb(p.jdUtc);
};
const RANGE = { start: jd(TIMELINE_START_UTC), end: jd(TIMELINE_END_UTC) };

export function timelineRangeTdb(): { start: number; end: number } {
  return RANGE;
}

export function fractionForJd(jdTdb: number): { fraction: number; outside: 'before' | 'after' | null } {
  if (jdTdb < RANGE.start) return { fraction: 0, outside: 'before' };
  if (jdTdb > RANGE.end) return { fraction: 1, outside: 'after' };
  return { fraction: (jdTdb - RANGE.start) / (RANGE.end - RANGE.start), outside: null };
}

export function jdForFraction(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return RANGE.start + f * (RANGE.end - RANGE.start);
}

export function timelineTicks(): Array<{ year: number; fraction: number }> {
  return [1800, 1850, 1900, 1950, 2000, 2050].map((year) => ({ year, fraction: fractionForJd(jd(`${year}-01-01`)).fraction }));
}
```

- [ ] **Step 4: Implement `BottomBar.tsx`**

Move the `TimeBar.tsx` body into `BottomBar`. Keep `VALIDITY_MESSAGES` (exported, unchanged), the date input form and the controls. Add:
```tsx
  const tourActive = useTourStore((s) => s.active);
  const toggleTour = useTourStore((s) => s.toggle);
  const skyRef = useSkyStore((s) => s.ref);
  const skySource = skyRef ? catalog.sources.get(skyRef.sourceId) : undefined;
  const { fraction, outside } = fractionForJd(jdTdb);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const publish = () => root.setProperty('--bottom-bar-height', `${Math.round(el.getBoundingClientRect().height + 16)}px`);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.removeProperty('--bottom-bar-height');
    };
  }, []);
```
and render, after the existing controls row:
```tsx
      <button type="button" className="tour-button" data-tour-toggle aria-pressed={tourActive} onClick={toggleTour} title="Guided tour (key T)">
        {tourActive ? 'Stop tour' : 'Tour'}
      </button>
      <div className="timeline">
        <input
          type="range"
          aria-label="Timeline 1800–2050"
          min={0}
          max={1000}
          step={1}
          value={Math.round(fraction * 1000)}
          onChange={(e) => setJdTdb(jdForFraction(Number(e.target.value) / 1000))}
        />
        <ol className="timeline__ticks" aria-hidden="true">
          {timelineTicks().map((t) => (
            <li key={t.year} style={{ left: `${t.fraction * 100}%` }}>{t.year}</li>
          ))}
        </ol>
        {outside && <p className="timeline__outside">Outside 1800–2050 — use Go to date</p>}
      </div>
      <footer className="bottom-bar__footer">
        {status !== 'high' && <p className="time-bar__warning" role="status">{VALIDITY_MESSAGES[status]}</p>}
        {skySource && (
          <p className="sky-credit">
            Sky: <a href={skySource.url} target="_blank" rel="noreferrer">{skySource.title}</a> — {skySource.publisher}
          </p>
        )}
      </footer>
```
Set the section's ref to `ref` and its classes to `glass bottom-bar`. The Tour button's `data-tour-toggle` attribute lets the tour's exit-on-input listener (Task 9) ignore that button.

CSS: replace `.time-bar` and the floating `.sky-credit` rules with:
```css
.bottom-bar {
  position: absolute;
  left: var(--gutter);
  right: var(--gutter);
  bottom: var(--gutter);
  z-index: 3;
  padding: 10px 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px 14px;
  align-items: center;
}
.timeline { grid-column: 1 / -1; position: relative; padding-bottom: 16px; }
.timeline input[type='range'] { width: 100%; accent-color: var(--accent); }
.timeline__ticks { position: absolute; left: 0; right: 0; bottom: 0; margin: 0; padding: 0; list-style: none; height: 14px; }
.timeline__ticks li { position: absolute; transform: translateX(-50%); color: var(--text-muted); font: 10px var(--font-mono); }
.timeline__outside { margin: 2px 0 0; color: var(--warning); font-size: 11px; }
.bottom-bar__footer { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: var(--text-muted); }
.sky-credit { margin: 0; }
.sky-credit a { color: inherit; }
.tour-button[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); }
@media (max-width: 720px) {
  .bottom-bar { left: 0; right: 0; bottom: 0; border-radius: var(--radius-lg) var(--radius-lg) 0 0; grid-template-columns: 1fr; }
}
```

In `App.tsx`, render `<BottomBar catalog={catalog} />` in place of `<TimeBar …/>` and `<SkyCredit …/>`. Delete `TimeBar.tsx` and `SkyCredit.tsx`, and remove their CSS.

- [ ] **Step 5: Update e2e**

- `e2e/app.spec.ts`: "jumps in time and warns about accuracy" keeps its labels ("Simulation date", "Now", the go-to-date input, the status role). Add an assertion that the timeline slider exists.
- `e2e/layout.spec.ts`: the sky credit now sits inside the bottom bar. Replace the floating-credit intersection checks with checks that `.bottom-bar` does not intersect `.header`, `.control-panel` or an open `.drawer`, at both viewports.

- [ ] **Step 6: Run the tests**

Run: `npm test`, `npm run typecheck`, `npx playwright test --reporter=list`
Expected: all PASS. View the overview and phone goldens, then commit.

```powershell
git add -A src e2e
git commit -m "feat(ui): add the bottom bar with a 1800–2050 timeline scrubber, the Tour button and the sky credit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pill labels with a live datum, and overlap decluttering

**Files:**
- Create: `src/scene/labels/labelLayout.ts`, `src/scene/labels/labelLayout.test.ts`, `src/ui/useLabelDeclutter.ts`
- Modify: `src/scene/BodyLabel.tsx`, `src/scene/BodyMesh.tsx` (pass `sunId`), `src/scene/SceneRoot.tsx` (mount the declutter pass on the label layer), `src/styles/app.css` (`.body-label` pill), `e2e/interface.spec.ts` (new)

**Interfaces:**
- Produces (`labelLayout.ts`):
  - `interface LabelBox { id: string; left: number; top: number; width: number; height: number; priority: number }`;
  - `resolveOverlaps(boxes: readonly LabelBox[], paddingPx = 4): Set<string>`, the ids of the labels to show. It works greedily in descending priority: a box is accepted when it intersects no accepted box (each grown by the padding). Ties go to the earlier id alphabetically, so the result is deterministic.
  - `labelPriority(input: { selected: boolean; hovered: boolean; pixelRadius: number }): number`, where selected beats hovered and hovered beats size.
- Produces (`BodyLabel`): a pill `<button className="body-label" aria-label={body.name} data-label-id={body.id} data-priority={...}>` containing:
  - `<span className="body-label__dot" style={{ background: body.display.color }}/>`;
  - `<span className="body-label__name">{body.name}</span>`;
  - `<span className="body-label__datum num" ref={datumRef}/>`.

  The datum text is written straight to the DOM at 4 Hz from `useFrame`, without React re-renders:
  - collapsed: distance from Earth (`formatAu`); Earth shows its distance from the Sun;
  - expanded (`.is-selected` or hovered): adds ` · 52 min light`;
  - `data-priority` is recomputed at 4 Hz from the selection and hover state and the on-screen radius in px (`renderRadius / distance × pixelsPerRadian`).
- Produces (`useLabelDeclutter(layerRef)`): every 100 ms, it reads `getBoundingClientRect()` of the `.body-label` elements in the layer, calls `resolveOverlaps`, and toggles `is-hidden` on the labels not shown. CSS fades them out over `var(--dur-fast)` and sets `pointer-events: none` while hidden.

- [ ] **Step 1: Write the failing tests**

`src/scene/labels/labelLayout.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { labelPriority, resolveOverlaps, type LabelBox } from './labelLayout';

const box = (id: string, left: number, top: number, priority: number): LabelBox => ({ id, left, top, width: 80, height: 22, priority });

describe('label decluttering', () => {
  it('keeps the highest-priority label in an overlapping cluster', () => {
    const shown = resolveOverlaps([box('mercury', 100, 100, 1), box('venus', 120, 104, 2), box('earth', 130, 108, 5)]);
    expect([...shown]).toEqual(['earth']);
  });
  it('keeps labels that do not overlap', () => {
    expect(resolveOverlaps([box('a', 0, 0, 1), box('b', 200, 0, 1), box('c', 0, 200, 1)]).size).toBe(3);
  });
  it('is deterministic for equal priorities', () => {
    expect([...resolveOverlaps([box('venus', 0, 0, 1), box('mars', 10, 0, 1)])]).toEqual(['mars']);
  });
  it('ranks selected over hovered over size', () => {
    const sel = labelPriority({ selected: true, hovered: false, pixelRadius: 1 });
    const hov = labelPriority({ selected: false, hovered: true, pixelRadius: 500 });
    const big = labelPriority({ selected: false, hovered: false, pixelRadius: 400 });
    const small = labelPriority({ selected: false, hovered: false, pixelRadius: 3 });
    expect(sel).toBeGreaterThan(hov);
    expect(hov).toBeGreaterThan(big);
    expect(big).toBeGreaterThan(small);
  });
});
```

`e2e/interface.spec.ts` (Review Focus #3):
```ts
import { expect, test } from '@playwright/test';

test('overview labels never overlap and the selected label always shows', async ({ page }) => {
  await page.goto('/?jd=2461317.5&pause=1&quality=low');
  await page.waitForTimeout(1500);
  const rects = await page.$$eval('.body-label:not(.is-hidden)', (els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!, b = rects[j]!;
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
  }
  await page.getByRole('button', { name: 'Mercury', exact: true }).dispatchEvent('click');
  await page.waitForTimeout(400);
  await expect(page.locator('.body-label[data-label-id="mercury"]')).not.toHaveClass(/is-hidden/);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/scene/labels`, then `npx playwright test e2e/interface.spec.ts --reporter=list`
Expected: FAIL (the module is missing; labels overlap in the overview).

- [ ] **Step 3: Implement `labelLayout.ts`**

```ts
export interface LabelBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  priority: number;
}

/** Greedy declutter: highest priority first; a label shows if it overlaps no label already shown. */
export function resolveOverlaps(boxes: readonly LabelBox[], paddingPx = 4): Set<string> {
  const ordered = [...boxes].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const accepted: LabelBox[] = [];
  const hit = (a: LabelBox, b: LabelBox) =>
    a.left - paddingPx < b.left + b.width && b.left - paddingPx < a.left + a.width && a.top - paddingPx < b.top + b.height && b.top - paddingPx < a.top + a.height;
  for (const box of ordered) if (!accepted.some((a) => hit(a, box))) accepted.push(box);
  return new Set(accepted.map((b) => b.id));
}

export function labelPriority(input: { selected: boolean; hovered: boolean; pixelRadius: number }): number {
  return (input.selected ? 1e7 : 0) + (input.hovered ? 1e6 : 0) + Math.min(input.pixelRadius, 1e5);
}
```

- [ ] **Step 4: Rework `BodyLabel.tsx` and add the declutter pass**

`BodyLabel.tsx`:
```tsx
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import type { Body } from '../core/catalog/schema';
import { length, sub } from '../core/math/vec3';
import { SPEED_OF_LIGHT_KM_S } from '../core/units';
import { useSelectionStore } from '../state/selectionStore';
import { useViewStore } from '../state/viewStore';
import { formatAu, formatLightTimeShort } from '../ui/format';
import { useFrameState } from './FrameStateContext';
import { labelPriority } from './labels/labelLayout';
import { useLabelLayer } from './LabelLayerContext';
import { pixelsPerRadian } from './scaleMode';

const DATUM_INTERVAL_S = 0.25;

/** sunId: the catalogue's star (Earth's label shows its distance from it); BodyMesh passes it from `bodies`. */
export function BodyLabel({ body, sunId }: { body: Body; sunId: string | undefined }) {
  const selected = useSelectionStore((s) => s.selectedId === body.id);
  const hovered = useSelectionStore((s) => s.hoveredId === body.id);
  const select = useSelectionStore((s) => s.select);
  const requestFocus = useViewStore((s) => s.requestFocus);
  const layer = useLabelLayer();
  const frame = useFrameState();
  const button = useRef<HTMLButtonElement>(null);
  const datum = useRef<HTMLSpanElement>(null);
  const since = useRef(DATUM_INTERVAL_S);

  useFrame((_, delta) => {
    since.current += delta;
    if (since.current < DATUM_INTERVAL_S || !button.current || !datum.current) return;
    since.current = 0;
    const pos = frame.bodyPositionsKm.get(body.id);
    const earth = frame.bodyPositionsKm.get('earth');
    const ref = body.id === 'earth' ? (sunId ? frame.bodyPositionsKm.get(sunId) : undefined) : earth;
    if (pos && ref) {
      const d = length(sub(pos, ref));
      const expanded = selected || hovered;
      datum.current.textContent = body.id === 'earth' ? `${formatAu(d)} from Sun` : expanded ? `${formatAu(d)} · ${formatLightTimeShort(d / SPEED_OF_LIGHT_KM_S)} light` : formatAu(d);
    }
    const r = frame.bodyRenderRadiusKm.get(body.id);
    if (pos && r) {
      const pixelRadius = (r / Math.max(length(sub(pos, frame.cameraPositionKm)), 1e-9)) * pixelsPerRadian(frame.viewportHeightPx, frame.fovRad);
      button.current.dataset.priority = String(labelPriority({ selected, hovered, pixelRadius }));
    }
  });

  return (
    <Html center zIndexRange={[20, 0]} portal={layer as RefObject<HTMLElement>}>
      <button
        ref={button}
        type="button"
        aria-label={body.name}
        data-label-id={body.id}
        className={selected ? 'body-label is-selected' : 'body-label'}
        onClick={() => select(body.id)}
        onDoubleClick={() => requestFocus(body.id)}
      >
        <span className="body-label__dot" style={{ background: body.display.color }} />
        <span className="body-label__name">{body.name}</span>
        <span ref={datum} className="body-label__datum num" />
      </button>
    </Html>
  );
}
```
In `BodyMesh.tsx`, render `<BodyLabel body={body} sunId={bodies.find((b) => b.category === 'star')?.id} />`. Earth is addressed by id `'earth'`, as M1's live distances already do.

`src/ui/useLabelDeclutter.ts`:
```ts
import { useEffect } from 'react';
import { resolveOverlaps, type LabelBox } from '../scene/labels/labelLayout';

/** Spec §4: labels fade when bodies overlap. Reads label rectangles at 10 Hz and hides the lower-priority ones. */
export function useLabelDeclutter(layer: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const id = window.setInterval(() => {
      const root = layer.current;
      if (!root) return;
      const els = [...root.querySelectorAll<HTMLElement>('.body-label')];
      const boxes: LabelBox[] = els.map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.dataset.labelId ?? '', left: r.left, top: r.top, width: r.width, height: r.height, priority: Number(el.dataset.priority ?? 0) };
      });
      const shown = resolveOverlaps(boxes.filter((b) => b.width > 0));
      for (const el of els) el.classList.toggle('is-hidden', !shown.has(el.dataset.labelId ?? ''));
    }, 100);
    return () => window.clearInterval(id);
  }, [layer]);
}
```
In `SceneRoot.tsx`, call `useLabelDeclutter(labelLayer)`.

CSS, replacing `.body-label`:
```css
.body-label {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 9px 3px 7px;
  border: 1px solid var(--hairline); border-radius: 999px;
  background: rgba(6, 9, 18, 0.72);
  backdrop-filter: blur(6px);
  color: var(--text); font-size: 11px; white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  transition: opacity var(--dur-fast) var(--ease), padding var(--dur-fast) var(--ease);
}
.body-label__dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
.body-label__name { font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; }
.body-label__datum { color: var(--text-muted); }
.body-label.is-selected { border-color: var(--accent); padding-right: 12px; }
.body-label.is-hidden { opacity: 0; pointer-events: none; }
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/scene`, `npm test`, `npm run typecheck`, `npx playwright test --reporter=list`
Expected: all PASS. Existing tests that find labels by `getByRole('button', { name: 'Jupiter', exact: true })` still work, because the accessible name is the body name. View the overview golden: the inner-planet labels are decluttered, and orbits stay visible.

- [ ] **Step 6: Commit**

```powershell
git add -A src e2e
git commit -m "feat(ui): pill labels with a live distance datum, decluttered by priority when they overlap" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tour mode

**Files:**
- Create: `src/camera/tour.ts`, `src/camera/tour.test.ts`, `src/ui/useTourExit.ts`
- Modify: `src/camera/CameraSystem.tsx` (run the tour; exit on input), `src/App.tsx` (mount `useTourExit`), `e2e/interface.spec.ts`

**Interfaces:**
- Consumes:
  - `orbitPose` and `OrbitState` from `orbitController.ts`;
  - `interpolatePose` from `transition.ts`;
  - `ControllerContext` and `CameraPose` from `types.ts`;
  - `useTourStore` (Task 3), `useSelectionStore` and `useViewStore`.
- Produces (`tour.ts`):
  - `TOUR = { flightS: 5, dwellS: 7, orbitRadPerS: 4°, elevationRad: 14°, distanceRadii: 6, sunDistanceRadii: 10, overviewDistanceKm: 2.2e9, overviewElevationRad: 30°, litOffsetRad: 35° }`;
  - `interface TourStop { targetId: string; selectId: string | null; distanceKm: number; elevationRad: number }`;
  - `buildTour(bodies): TourStop[]`: the Sun, then the planets by `semiMajorAxisAu` ascending, then the overview (target the Sun, `selectId: null`, overview distance);
  - `tourPhase(stopCount, elapsedS): { index: number; phase: 'flight' | 'dwell'; t: number } | null`, where `null` means the tour is finished;
  - `litAzimuth(bodyKm: Vec3, sunKm: Vec3): number`, the azimuth that puts the camera on the sunlit side, offset by `litOffsetRad`;
  - `stopPose(stop, ctx, azimuthRad): CameraPose | null`.
- Produces (`CameraSystem`): while `tourStore.active`, the camera follows the tour.
  - **On each new stop** it selects `stop.selectId` (so the Header headline changes; the overview deselects) and records the current pose as that stop's flight start.
  - **Flight:** `interpolatePose(flightFrom, stopPose, t)`, or a cut under reduced motion.
  - **Dwell:** `stopPose` with the azimuth advanced by `orbitRadPerS × dwell time`.
  - **Ending:** any non-zero input delta ends the tour, as does finishing it. On exit it switches to Orbit with `orbit.enter(lastPose, ctx, currentStop.targetId)` and clears the tour state.
  - Starting a tour switches the view to Orbit. Simulation time is never changed.
- Produces (`useTourExit()`): window `pointerdown`, `wheel` and `touchstart` listeners (capture phase) that stop an active tour, unless the event target is inside `[data-tour-toggle]`. Keys are already handled by `useHotkeys`.

- [ ] **Step 1: Write the failing tests**

`src/camera/tour.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { length, sub, type Vec3 } from '../core/math/vec3';
import { makeEarth, makeJupiter, makeSun } from '../test/fixtures';
import { buildTour, litAzimuth, stopPose, TOUR, tourPhase } from './tour';
import type { ControllerContext } from './types';

const bodies = [makeJupiter(), makeSun(), makeEarth()];

describe('tour', () => {
  it('visits the Sun, the planets outward, then the overview', () => {
    const stops = buildTour(bodies);
    expect(stops.map((s) => s.selectId)).toEqual(['sun', 'earth', 'jupiter', null]);
    expect(stops.at(-1)!.distanceKm).toBe(TOUR.overviewDistanceKm);
    expect(stops[1]!.distanceKm).toBeCloseTo(makeEarth().shape.equatorialRadiusKm * TOUR.distanceRadii, 6);
  });
  it('alternates flight and dwell for each stop, then ends', () => {
    const per = TOUR.flightS + TOUR.dwellS;
    expect(tourPhase(4, 0)).toEqual({ index: 0, phase: 'flight', t: 0 });
    expect(tourPhase(4, TOUR.flightS + TOUR.dwellS / 2)).toEqual({ index: 0, phase: 'dwell', t: 0.5 });
    expect(tourPhase(4, per * 2 + 1)!.index).toBe(2);
    expect(tourPhase(4, per * 4)).toBeNull();
  });
  it('places the camera at the stop distance on the sunlit side', () => {
    const body: Vec3 = [1.5e8, 0, 0];
    const sun: Vec3 = [0, 0, 0];
    const ctx: ControllerContext = { bodyPosition: (id) => (id === 'earth' ? body : sun), bodyRadiusKm: () => 6378, bodyOrientation: () => undefined };
    const stop = buildTour(bodies)[1]!;
    const pose = stopPose(stop, ctx, litAzimuth(body, sun))!;
    expect(length(sub(pose.positionKm, body))).toBeCloseTo(stop.distanceKm, 3);
    expect(pose.positionKm[0]).toBeLessThan(body[0]); // camera between the body and the Sun: lit side
  });
});
```

Append to `e2e/interface.spec.ts` (Review Focus #1):
```ts
test('T starts the tour, any key stops it, and Orbit control returns', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: /Stop tour/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Sun' })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Tour', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'true');
});

test('a click stops the tour', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await page.getByRole('button', { name: 'Tour', exact: true }).click();
  await expect(page.getByRole('button', { name: /Stop tour/ })).toBeVisible();
  await page.mouse.click(640, 360);
  await expect(page.getByRole('button', { name: 'Tour', exact: true })).toHaveAttribute('aria-pressed', 'false');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/camera/tour.test.ts`
Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement `src/camera/tour.ts`**

```ts
import type { Body } from '../core/catalog/schema';
import { DEG } from '../core/math/angles';
import type { Vec3 } from '../core/math/vec3';
import { orbitPose } from './orbitController';
import type { CameraPose, ControllerContext } from './types';

export const TOUR = {
  flightS: 5,
  dwellS: 7,
  orbitRadPerS: 4 * DEG,
  elevationRad: 14 * DEG,
  distanceRadii: 6,
  sunDistanceRadii: 10,
  overviewDistanceKm: 2.2e9,
  overviewElevationRad: 30 * DEG,
  litOffsetRad: 35 * DEG,
} as const;

export interface TourStop {
  targetId: string;
  /** The body to select at this stop (the header headline changes); null deselects for the overview. */
  selectId: string | null;
  distanceKm: number;
  elevationRad: number;
}

const semiMajorAxis = (b: Body) => {
  const v = b.facts.semiMajorAxisAu?.value;
  return typeof v === 'number' ? v : Number.POSITIVE_INFINITY;
};

export function buildTour(bodies: readonly Body[]): TourStop[] {
  const sun = bodies.find((b) => b.category === 'star');
  if (!sun) return [];
  const planets = bodies.filter((b) => b.category === 'planet').sort((a, b) => semiMajorAxis(a) - semiMajorAxis(b));
  return [
    { targetId: sun.id, selectId: sun.id, distanceKm: sun.shape.equatorialRadiusKm * TOUR.sunDistanceRadii, elevationRad: TOUR.elevationRad },
    ...planets.map((p) => ({ targetId: p.id, selectId: p.id, distanceKm: p.shape.equatorialRadiusKm * TOUR.distanceRadii, elevationRad: TOUR.elevationRad })),
    { targetId: sun.id, selectId: null, distanceKm: TOUR.overviewDistanceKm, elevationRad: TOUR.overviewElevationRad },
  ];
}

export function tourPhase(stopCount: number, elapsedS: number): { index: number; phase: 'flight' | 'dwell'; t: number } | null {
  const per = TOUR.flightS + TOUR.dwellS;
  const e = Math.max(0, elapsedS);
  const index = Math.floor(e / per);
  if (index >= stopCount) return null;
  const local = e - index * per;
  return local < TOUR.flightS ? { index, phase: 'flight', t: local / TOUR.flightS } : { index, phase: 'dwell', t: (local - TOUR.flightS) / TOUR.dwellS };
}

/** Camera azimuth on the sunlit side of a body (toward the Sun, offset so the terminator shows). */
export function litAzimuth(bodyKm: Vec3, sunKm: Vec3): number {
  return Math.atan2(sunKm[1] - bodyKm[1], sunKm[0] - bodyKm[0]) + TOUR.litOffsetRad;
}

export function stopPose(stop: TourStop, ctx: ControllerContext, azimuthRad: number): CameraPose | null {
  const target = ctx.bodyPosition(stop.targetId);
  if (!target) return null;
  return orbitPose({ targetId: stop.targetId, distanceKm: stop.distanceKm, azimuthRad, elevationRad: stop.elevationRad, panOffsetKm: [0, 0, 0] }, target);
}
```
Check that `orbitPose` places the camera at `target + offsetDirection(az, el) × distance`, so that azimuth 0 points along +x from the target. That convention is what makes the "lit side" test hold. If the direction convention is opposite, adjust `litAzimuth` (not the test), and say so in the report.

- [ ] **Step 4: Run the tour in `CameraSystem.tsx`**

Add to `Rig`:
```ts
  tour: { seq: number; startedAt: number; stops: TourStop[]; index: number; flightFrom: CameraPose | null } | null;
```
(initialised to `null`). In `useFrame`, after the camera-override block and before the normal view logic:
```ts
    const tourState = useTourStore.getState();
    if (tourState.active) {
      if (!r.tour || r.tour.seq !== tourState.seq) {
        r.tour = { seq: tourState.seq, startedAt: now, stops: buildTour(catalog.bodies), index: -1, flightFrom: r.lastPose };
        useViewStore.getState().setView('orbit');
        r.activeView = 'orbit';
        r.transition = null;
      }
      const deltas = input.consume();
      const moved = deltas.rotateX || deltas.rotateY || deltas.panX || deltas.panY || deltas.zoom;
      const phase = tourPhase(r.tour.stops.length, now - r.tour.startedAt);
      if (moved || !phase) {
        useTourStore.getState().stop();
      } else {
        if (phase.index !== r.tour.index) {
          r.tour.index = phase.index;
          r.tour.flightFrom = r.lastPose;
          useSelectionStore.getState().select(r.tour.stops[phase.index]!.selectId);
        }
        const stop = r.tour.stops[phase.index]!;
        const sunId = catalog.bodies.find((b) => b.category === 'star')?.id;
        const bodyKm = ctx.bodyPosition(stop.targetId) ?? [0, 0, 0];
        const sunKm = (sunId && ctx.bodyPosition(sunId)) || [0, 0, 0];
        const az = (stop.targetId === sunId ? -90 * DEG : litAzimuth(bodyKm, sunKm)) + (phase.phase === 'dwell' ? phase.t * TOUR.dwellS * TOUR.orbitRadPerS : 0);
        const target = stopPose(stop, ctx, az);
        if (target) {
          const pose = phase.phase === 'flight' && r.tour.flightFrom && !prefersReducedMotion() ? interpolatePose(r.tour.flightFrom, target, phase.t) : target;
          r.lastPose = pose;
          frame.cameraPositionKm = pose.positionKm;
          camera.position.set(0, 0, 0);
          camera.quaternion.setFromRotationMatrix(writeMatrix4(lookRotation(pose.positionKm, pose.lookAtKm, pose.up), matrix));
          return;
        }
      }
    }
    if (r.tour) {
      // Tour ended (input, completion or toggle): hand control back to Orbit around the current stop, from where we are.
      const current = r.tour.stops[Math.max(0, r.tour.index)];
      r.orbit.enter(r.lastPose, ctx, current?.targetId);
      r.activeView = 'orbit';
      useViewStore.getState().setView('orbit');
      r.tour = null;
      r.transition = null;
    }
```
Ordering: the tour block must run after the existing override block. The `const { view, coRotate, focusRequest } = useViewStore.getState();` read must come after the tour block, so the view set here is seen in the same frame. Move that read if needed, and keep the M2a.1 override placement rule (override before the view read).

`src/ui/useTourExit.ts`:
```ts
import { useEffect } from 'react';
import { useTourStore } from '../state/tourStore';

/** Spec §5: any user input exits the tour. Keys are handled by useHotkeys; the Tour button toggles instead. */
export function useTourExit(): void {
  useEffect(() => {
    const stop = (e: Event) => {
      if (!useTourStore.getState().active) return;
      if (e.target instanceof Element && e.target.closest('[data-tour-toggle]')) return;
      useTourStore.getState().stop();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', stop, opts);
    window.addEventListener('wheel', stop, opts);
    window.addEventListener('touchstart', stop, opts);
    return () => {
      window.removeEventListener('pointerdown', stop, opts);
      window.removeEventListener('wheel', stop, opts);
      window.removeEventListener('touchstart', stop, opts);
    };
  }, []);
}
```
In `App.tsx`, call `useTourExit()` next to `useHotkeys()`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/camera`, `npm test`, `npm run typecheck`, `npx playwright test e2e/interface.spec.ts e2e/app.spec.ts --reporter=list`
Expected: all PASS.

Then run a full tour manually with `npm run dev`, or a scratch Playwright script that screenshots every 3 s. Check that:
- each planet is framed lit;
- the headline changes per stop;
- the overview ends the tour cleanly.

Describe it in the report.

- [ ] **Step 6: Commit**

```powershell
git add src e2e
git commit -m "feat(camera): add Tour mode (Sun, planets outward, overview) that any user input exits" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Venus Magellan radar view

**Files:**
- Modify:
  - `pipeline/textures/manifest.ts` and `manifest.test.ts` (product and source);
  - `pipeline/textures/build.ts` and `build.test.ts` (`radar` layer job and Maxwell Montes check);
  - `pipeline/textures/derive.ts` and `derive.test.ts` (`meanInBox`);
  - `src/core/catalog/schema.ts` (`Imagery.radar`);
  - `src/ui/imagery.ts` and `imagery.test.ts` (Radar line and note);
  - `src/state/viewStore.ts` (`venusRadar`);
  - `src/state/urlParams.ts` (`radar=1`);
  - `src/scene/materials/VenusMaterial.tsx`;
  - `src/scene/materials/BodyMaterial.tsx` (hide the Venus atmosphere while radar is on);
  - `src/ui/FactsDrawer.tsx` (toggle);
  - `e2e/golden.spec.ts` (Venus radar view);
  - the regenerated `public/textures/venus/radar_1k.webp` and `radar_2k.webp`, `public/textures/imagery.json` and `public/data/solar-system/*.json`.
- Create: `Space_visualizer/Data Sources/USGS Venus Magellan C3-MDIR Mosaic.md`

**Interfaces:**
- Produces (`manifest.ts`):
  - product `'venus-radar'`: `{ url: \`${USGS}/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m.tif\`, cacheName: 'venus-radar.tif', sourceId: 'usgs-venus-magellan-c3', approxBytes: 178_000_000, lonOffsetDeg: 0 }`. Verify the URL and size with `npm run textures:verify`, then set `approxBytes` from the HEAD Content-Length.
  - source `usgs-venus-magellan-c3`: title "Venus Magellan Global C3-MDIR Mosaic 2025m", publisher "USGS Astrogeology Science Center (NASA Magellan data)", URL `https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_mosaic_2025m`, licence: public domain.
- Produces (`build.ts`):
  - the `Layer` type gains `'radar'`;
  - `LAYER_JOBS` gains `{ body: 'venus', layer: 'radar', product: 'venus-radar', kind: 'gray', maxTier: '4k', derivation: 'Magellan C3-MDIR radar backscatter mosaic (2025 m/pixel); radar brightness, not visible light.' }`. The source is 18,775 px wide, so the tiers are 1k, 2k and local 4k.
- Produces (`derive.ts`): `meanInBox(values, w, h, box: { lonMin, lonMax, latMin, latMax }): number`.
- Validation: for `venus-radar` at 1k, the mean of the Maxwell Montes box (lon 0–7°E, lat 62–68°N) must exceed 1.3 × the global mean. Otherwise throw `venus radar orientation check failed …`.
- Produces (schema): `ImagerySchema` gains `radar: TextureRefSchema.optional()`.
- Produces (`imagery.ts`): `LAYERS` gains `['radar', 'Radar (Magellan)']`, so the drawer line and its citation follow automatically. `illustrativeNotes(venus)` adds "Radar view: Magellan radar backscatter of the surface under the clouds — brightness is radar roughness, not visible light." when `imagery.radar` exists.
- Produces (`viewStore`): `venusRadar: boolean` (default false) and `setVenusRadar(on)`. The URL parameter `radar=1` sets it.
- Produces (`VenusMaterial`): when `venusRadar` is on and the radar texture is loaded, Venus shows the radar mosaic as a grey albedo, Lambert-lit with the soft terminator plus the cinematic fill. Otherwise it shows the M2a.1 cloud deck. In `BodyExtras`, the Venus atmosphere shell is omitted while radar is on.
- Produces (drawer): in Imagery, for a body with `imagery.radar`, a checkbox "Show Magellan radar (surface under the clouds)" bound to `venusRadar`.

- [ ] **Step 1: Write the failing tests**

- `derive.test.ts`: `meanInBox` on a synthetic 360×180 grid. Set a bright 10° box at 0–10°E, 60–70°N, and check the box mean versus the global mean, and that the edges are inclusive.
- `build.test.ts`: assert that `LAYER_JOBS` contains the Venus radar job, and that `tiersFor` on an 18,775 px source with hd yields `['1k', '2k', '4k']`.
- `manifest.test.ts`: the product count rises to 18, and the radar product cites a registered source.
- `imagery.test.ts`: with a Venus fixture carrying `imagery.radar`, `imageryLines` includes `{ label: 'Radar (Magellan)', … }`, and `illustrativeNotes` includes the radar note.
- `urlParams.test.ts`: `?radar=1` → `{ venusRadar: true }`, applied to `viewStore`.

Run: `npx vitest run pipeline/textures src/ui src/state`
Expected: FAIL.

- [ ] **Step 2: Implement the pipeline changes and regenerate**

Implement `meanInBox`, the manifest entries, the layer job and the validation, plus the schema field. Then:

Run: `npm run textures:verify` (the new URL must answer 200), then `npm run textures` (it downloads about 170 MB once and builds the radar tiers), then `npm run data:offline`.
Expected:
- the build passes the new Maxwell Montes check;
- `public/textures/venus/radar_1k.webp` and `radar_2k.webp` exist;
- `imagery.json` and `bodies.json` list `venus.imagery.radar`, cited to `usgs-venus-magellan-c3`;
- the committed texture size stays at or under 60 MB.

View `radar_2k.webp`: Maxwell Montes is bright in the upper part of the map, near longitude 0 (centre). Ishtar Terra and Aphrodite Terra read as broad bright highlands.

If the check fails, look at the GeoTIFF's layout (`imageInfo`, sample format, any no-data value) before touching the threshold. Record what you found.

- [ ] **Step 3: Add the radar view at runtime**

`viewStore.ts`: add `venusRadar: false` and `setVenusRadar: (venusRadar) => set({ venusRadar })`.
`urlParams.ts`: parse `radar=1` into `venusRadar: true`, and apply it.

`VenusMaterial.tsx`:
- add `uRadarMap` and `uRadar` uniforms;
- load the texture with `useTieredTexture(venusRadar ? body.imagery?.radar : undefined, { maxTier: tier, srgb: true })`;
- add a branch in the fragment shader:
```glsl
  if (uRadar > 0.5) {
    vec3 radar = texture2D(uRadarMap, vUv).rgb;
    float lit = smoothstep(-0.06, 0.25, geo) * max(geo, 0.0);
    gl_FragColor = vec4(radar * lit * uSunIntensity * eclipseFactor(s) + cinematicFill(radar, n, v), 1.0);
  } else { /* existing cloud-deck code */ }
```
  Keep the GLSL ASCII-only and NaN-safe, and keep `FRAG_OUTRO` at the end of `main`.
- `uRadar` = `venusRadar && texture ? 1 : 0`.

`BodyMaterial.tsx`: in `BodyExtras`, render the `AtmosphereShell` only when `!(body.render.shader === 'venus' && venusRadar)`.

`FactsDrawer.tsx`: in the Imagery section, add the toggle when `body.imagery?.radar` exists:
```tsx
        {body.imagery?.radar && (
          <label className="toggle">
            <input type="checkbox" checked={venusRadar} onChange={(e) => setVenusRadar(e.target.checked)} />
            Show Magellan radar (surface under the clouds)
          </label>
        )}
```

`e2e/golden.spec.ts`: add the view `0b-venus-radar` at `/?jd=2461317.5&pause=1&target=venus&dist=30000&azSun=60&el=10&radar=1&quality=high&fx=1`.

- [ ] **Step 3b: Write the Data Sources note**

Create `Space_visualizer/Data Sources/USGS Venus Magellan C3-MDIR Mosaic.md`, in the format of the other imagery notes. Cover:
- publisher, URL, file, licence and size;
- its use as `venus/radar` 1k/2k (4k local);
- the derivation;
- the Maxwell Montes validation;
- that it shows radar backscatter, not visible light.

Link it from Home under Data Sources.

- [ ] **Step 4: Run the tests and review**

Run: `npm test`, `npm run typecheck`, `npx playwright test --reporter=list`
Expected: all PASS.

View `0b-venus-radar.png`: Venus shows the radar mosaic, lit, with no cloud deck or haze. Open the drawer: the Imagery section lists "Radar (Magellan)" with a citation, the note, and the toggle checked.

- [ ] **Step 5: Commit**

```powershell
git add pipeline src public Space_visualizer e2e
git commit -m "feat(venus): add the Magellan radar view from the USGS C3-MDIR mosaic, cited and toggled in the drawer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Phone layout and motion polish

**Files:**
- Modify: `src/styles/app.css`, `src/ui/Header.tsx` (publish `--header-bottom`; compact phone mode), `e2e/layout.spec.ts`

**Interfaces:**
- Produces: the Header publishes `--header-bottom` the same way the other bars publish theirs.
- Phone rules (≤720 px):
  - **Header:** full width, but leaving room for the Controls button (`width: calc(100vw - 2 * var(--gutter) - 110px)`). Headline about 26 px. Chips scroll horizontally on one line (`overflow-x: auto`). The narrative is clamped to two lines, and tapping it expands it (a `.is-expanded` toggle).
  - **Drawer sheet:** `max-height: calc(100vh - var(--header-bottom, 160px) - var(--bottom-bar-height, 140px) - 16px)`, so it never covers the header.
  - **Control panel:** collapsed by default (Task 5). When open it drops down over the scene, but never over the bottom bar (`max-height` uses `--bottom-bar-height`).
- Motion:
  - the drawer slides; the headline crossfades (Task 4); label fades (Task 8); the controls panel opens with an opacity and translate transition;
  - every transition uses `var(--dur)` / `var(--dur-fast)`, so `prefers-reduced-motion` disables all of them (Task 3 tokens);
  - "ticking numbers": the chip and pill values update live with `tabular-nums`, so digits don't jitter.

- [ ] **Step 1: Write the failing layout tests** (`e2e/layout.spec.ts`, Review Focus #4)

```ts
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
  for (const drawer of [false, true]) {
    test(`panels never overlap at ${viewport.width}x${viewport.height}, drawer ${drawer ? 'open' : 'closed'}`, async ({ browser }) => {
      const page = await browser.newPage({ viewport });
      await page.goto('/?target=jupiter&pause=1&quality=low');
      await expect(page.locator('canvas')).toBeVisible();
      if (drawer) await page.keyboard.press('f');
      await page.waitForTimeout(600);
      const ids = ['.header', '.control-panel', '.bottom-bar', ...(drawer ? ['.drawer'] : [])];
      const rects = await Promise.all(ids.map((s) => page.locator(s).boundingBox()));
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!, b = rects[j]!;
          const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
          expect(apart, `${ids[i]} overlaps ${ids[j]}`).toBe(true);
        }
      }
      await page.close();
    });
  }
}
```
Keep the existing layout tests that still apply. Remove the ones made obsolete by the sky credit moving into the bottom bar, and record which.

Run: `npx playwright test e2e/layout.spec.ts --reporter=list`
Expected: some FAIL on the phone (header versus Controls button, sheet versus header).

- [ ] **Step 2: Implement the phone CSS and `--header-bottom`, and run until green**

Add the publish effect to `Header.tsx` (the same ResizeObserver pattern, with `--header-bottom`), and the phone rules above. Iterate until every layout test passes at both viewports.

View `5-phone.png`, and a phone render with the drawer open (add it as a golden, `5b-phone-drawer`, at 390×844, opened with F). Check that:
- the panels are usable;
- the sheet sits between the header and the bottom bar;
- the text is legible.

- [ ] **Step 3: Commit**

```powershell
git add src e2e
git commit -m "feat(ui): phone layout (compact header, bottom-sheet drawer, collapsible controls) and motion that respects reduced motion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: End-to-end coverage, goldens and documentation

**Files:**
- Modify: `e2e/interface.spec.ts`, `e2e/golden.spec.ts`, `README.md`, `docs/SETUP.md`, the vault (`Architecture/ui.md`, `Architecture/camera.md`, `Architecture/pipeline.md`, `Architecture/Overview.md`, `Changelog.md`, `Home.md`, `Plans/2026-10-05-m2a1-carry-over.md`)

**Interfaces:**
- Produces the spec §7 end-to-end items this section owns:
  - selection updates the header and chips;
  - the drawer lists Imagery sources (this already exists; make sure it opens the drawer first);
  - Tour starts and any key stops it (Task 9).
- Produces refreshed goldens in `Space_visualizer/Assets/m2a3-golden/`.

- [ ] **Step 1: Add the header e2e test**

Append to `e2e/interface.spec.ts`:
```ts
test('selection updates the header and its cited chips', async ({ page }) => {
  await page.goto('/?pause=1&quality=low');
  await expect(page.getByRole('heading', { name: 'Solar System' })).toBeVisible();
  await page.getByRole('button', { name: 'Jupiter', exact: true }).dispatchEvent('click');
  const header = page.getByRole('banner', { name: 'Selected body' });
  await expect(header.getByRole('heading', { name: 'Jupiter' })).toBeVisible();
  await expect(header).toContainText('From Earth');
  await expect(header).toContainText('AU');
  expect(await header.getByRole('link', { name: /Source \d+/ }).count()).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Mars', exact: true }).dispatchEvent('click');
  await expect(header.getByRole('heading', { name: 'Mars' })).toBeVisible();
});
```
Use the same header locator the Task 6 e2e test settled on.

- [ ] **Step 2: Refresh the goldens and review them against the spec §7 checklist**

Run: `npx playwright test e2e/golden.spec.ts --reporter=list`. View every PNG.

| View | M2a.3 must show |
|---|---|
| Overview | The header in overview mode, the control panel, decluttered pill labels and the bottom bar timeline. Nothing overlaps |
| Earth, Saturn, Sun, Mars | The header with headline, chips and narrative, in the body's accent colour. The scene is unchanged from M2a.2 |
| 0b Venus radar | The radar mosaic on Venus |
| Phone, and phone with drawer | Panels usable, the drawer as a sheet, legible text |

Copy the PNGs to `Space_visualizer/Assets/m2a3-golden/`.

- [ ] **Step 3: Documentation**

- **README:**
  - update the controls section: header, control panel, drawer (**F**), timeline, Tour (**T**), and the Venus radar toggle;
  - add the URL parameter `radar=1`.
- **SETUP:**
  - the Venus radar product adds about 170 MB to the texture cache;
  - in troubleshooting: "Tour stops immediately — any key, click, wheel or touch ends it by design".
- **Vault:**
  - **`Architecture/ui.md`:** rewrite it for the new components (Header, ControlPanel, FactsDrawer, BottomBar, pill labels and declutter, hotkeys, uiStore and tourStore, `citationModel` shared numbering, `narrative` rules, the published layout variables).
  - **`Architecture/camera.md`:** add a Tour section (stops, phases, exit rules, reduced motion).
  - **`Architecture/pipeline.md`:** the Venus radar product and the Maxwell Montes check.
  - **`Architecture/Overview.md`:** update the module map if it lists UI components.
  - **`Changelog.md`:** an M2a.3 entry.
  - **`Home.md`:** the M2a.3 plan (complete), the new Data Sources note and the golden assets.
  - **Carry-over note:**
    - mark these done: the two "Must do at the start of M2a.3" items, phone layout, label occlusion and clutter, and the Venus radar;
    - leave M2b/M2c items open.

- [ ] **Step 4: Final verification and commit**

Run: `npm test`, `npm run typecheck`, `npx playwright test --reporter=list`
Expected: all PASS.

```powershell
git add -A e2e README.md docs Space_visualizer
git commit -m "docs: M2a.3 interface, tour and Venus radar documentation, goldens and e2e coverage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
