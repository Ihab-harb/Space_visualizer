---
title: ui
tags: [architecture]
---

# ui (`src/ui`)

Back to [[Home]] · [[Overview]] · Built in [[2026-10-07-m2a3-interface-and-tour]] (spec §4)

**Layout:** header top-left, control panel top-right, pill labels over the scene, bottom bar along the bottom, facts drawer on the right. Dark frosted-glass panels with hairline borders (tokens in `src/styles`), Inter for text and a monospace face for numbers, cyan for interaction, amber for warnings and each body's accent colour (`body.display.color`) for its headline and values. Motion respects `prefers-reduced-motion`.

## Components
- **Header** (`role="banner"`, named "Selected body" when a body is selected). Overview mode: "Solar System", the UTC date, scale and bodies in view (`sceneStatsStore`, projected at about 2 Hz). Selected mode: kind and distance, the name in the body's accent colour, cited chips (From Earth or From the Sun, light time, day length, mean temperature), a narrative, and the buttons Facts & sources, Centre view (Orbit view only) and Deselect (×). Each chip carries `[n]`, a link that opens the drawer at that source. On phones it is compact (shorter chips, "Show more" for the narrative).
- **Narrative** (`narrative.ts`): two or three sentences built only from cited facts and live values. A sentence whose fact is missing is dropped; every number is a `value` part with its source id. Stars get their own sentence (spectral type and radius).
- **`citationModel`** (`citations.ts`): the single source numbering shared by the header and the drawer: the body's own sources in display order, then the live position model if it is not already listed. Header `[n]` and drawer list items always agree.
- **`liveStats`** (`liveStats.ts`): distances from the Sun and Earth and light time (exact SI speed of light) with the source that backs them. `format.ts` holds the number formatters.
- **ControlPanel:** View (Orbit, Follow), Style (Realistic; Exhibit is disabled until M2c), Scale (Readable, True scale), Quality (Auto, High, Medium, Low) and the Camera effects checkbox, plus a key hint. It publishes `--control-panel-bottom`. On phones it collapses behind a "Controls" button and opens as a dropdown that is topmost and opaque.
- **FactsDrawer** (`role="complementary"` named "Body information"): description, physical and orbital facts, live values, accuracy lines, Imagery (every layer cited; procedural visuals labelled illustrative; the Venus radar toggle) and the numbered sources. When closed it is `aria-hidden` and `inert`. Opening it from a header chip scrolls to and highlights that source. On phones it is a bottom sheet between the header and the bottom bar.
- **BottomBar:** the UTC date, Reverse, Play/Pause, Speed, Now, "Go to date" (`YYYY-MM-DD[ HH:MM[:SS]]`, years -4712 to 9999, impossible dates rejected), the Tour button ("Tour" / "Stop tour", `aria-pressed`), the 1800-2050 timeline scrubber (`timeline.ts`), a validity status (amber outside 1800-2050, an extrapolation warning outside 3000 BC-AD 3000) and the sky credit. It publishes `--bottom-bar-height`. The compact phone bar is about 157-170 px.
- **Pill labels** (`src/scene/BodyLabel.tsx`): a dot, the NAME in capitals and a datum (distance, or light time for the selected body), updated at 4 Hz. Each label's accessible name is the body name. `labelLayout.ts` has `resolveOverlaps` (hide the lower priority of two overlapping boxes, 4 px padding) and `labelPriority` (selected, then hovered, then larger pixel radius, ties alphabetical). `useLabelDeclutter` reads label rectangles at 10 Hz and applies it. In the overview this hides Earth behind the Sun's label; hovering or selecting brings a label back.
- **Status screens:** loading, data error with "Try again", and "3D graphics are not available" when WebGL is missing.

## State and keys
- **`uiStore`:** `drawerOpen`, `controlsOpen` (phone), `focusSource`/`revealSource`. The drawer and the phone Controls dropdown are mutually exclusive: opening one closes the other.
- **`tourStore`:** `active`, `seq`, `start`, `stop`, `toggle`. See Tour in [[camera]].
- **`hotkeys.ts`** is the single owner of keys: **1** Orbit, **2** Follow, **Esc** Orbit, **T** Tour, **Q** cycles Quality, **E** toggles Camera effects, **F** toggles the drawer. Keys are ignored while typing (input, select, textarea, contentEditable), with Ctrl, Cmd or Alt held, and on auto-repeat. While a tour runs any other key stops it (a bare modifier does not). `useTourExit` stops the tour on pointer, wheel and touch input, except on the Tour button, which toggles.

## Published layout variables
CSS custom properties on the document root, so panels never overlap: `--control-panel-bottom` (ControlPanel), `--bottom-bar-height` (BottomBar: distance from the viewport bottom to the bar's top), `--header-bottom` (Header, phone). The drawer's top and bottom, and the phone header and Controls limits, are computed from them (with fallbacks before they are published). Layout tests (`e2e/layout.spec.ts`) check that no two panels intersect at desktop (1280x720) and phone (390x844) sizes.

## Look and accessibility
Stable names: the drawer is "Body information"; controls keep their visible names (Orbit, Follow, Readable, True scale, Auto, High, Medium, Low, Camera effects, Now, Go, Tour). Slide and fade transitions are switched off under reduced motion (`@media (prefers-reduced-motion: reduce)` in `app.css`), the drawer scroll to a source uses `auto` instead of `smooth`, and Tour flights become cuts.
