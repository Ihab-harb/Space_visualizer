---
title: state
tags: [architecture]
---

# state (`src/state`)

Back to [[Home]] · [[Overview]]

| Module | Holds |
|---|---|
| `timeStore` | `jdTdb`, play/pause, speed step (real time up to 1 year/s), direction. `advance(dt)` applies at most `MAX_FRAME_DT_S` (0.1 s) of real time per frame; JD is clamped to [0, year 10 000] and playback stops at the clamp. |
| `selectionStore` | Selected and hovered body ids. |
| `viewStore` | Active view (orbit/follow), co-rotation, scale mode (readable/true), numbered focus requests, `venusRadar` (the Venus radar view, URL `radar=1`). |
| `uiStore` | Drawer open, phone Controls open (mutually exclusive), the source the drawer should scroll to. |
| `tourStore` | Tour `active` and a restart counter `seq`. |
| `sceneStatsStore` | Bodies in view, updated at about 2 Hz for the header. |
| `catalogStore` | Load status, the `Catalog`, and a readable error message. |
| `detailsStore` | One entry per body id, loaded on demand (M2b.1): `loading`, `ready` (a validated `BodyDetails`), `missing` (HTTP 404) or `error` (any other failure, with a message). `useBodyDetails(id)` starts the fetch the first time a body is selected; details files are never requested at startup. `retry(id)` refetches after `missing` or `error`. A response is parsed with `BodyDetailsSchema` and must describe the requested body. |
| `loadCatalog` | Fetches `data/regions.json`, `data/sources.json` and each region's bodies file; validates them with the [[core]] schemas and checks that every `sourceId` resolves. |

## Explore (M2b.3)
- **`exploreStore`:** `active`, `bodyId`, `view` (`whole`, `exploded` or `section`), `progress` (0 whole to 1 fully open; written by the scene while active), `chartOpen`, `selectedLayerId`, `sectionSeq` (bumped each time Half-section is chosen, so the scene turns the cut to face the camera again) and `saved` (play state and speed from before Explore). `enter(bodyId)` stops the tour, saves the time state (re-entering keeps the first save), pauses time and resets to Whole. `leave()` restores time only if Explore was active, then resets everything. The store subscribes to `selectionStore`: selecting another body, or none, leaves Explore.
- **`useExploreSession`:** `{ bodyId }`, written only by the scene driver. It is set from the first frame after `enter` until the body has closed after `leave` (exactly while `frame.explore` is set). `useExploreOwnsScreen()` is `active || session open`. `AppChrome` hides the normal interface while it is true, so the interface returns only after the body has closed.
- **URL parameters (`urlParams.ts`):** `explore=1` enters Explore on the `target` body (ignored without a valid target) and `view=whole|exploded|section` sets the view. `dist` is ignored in Explore: the body is framed at 3.4 radii.

## Feature pins (M2b.4a)
Built in [[2026-11-15-m2b4a-feature-pins]] (Task 6).
- **Tabs:** `ExploreTab` is `surface` or `interior`; `tabOf(view)` maps `whole` to Surface and the two interior views to Interior. `setTab('surface')` sets view `whole`; `setTab('interior')` opens `lastInteriorView` (Exploded first, then whichever interior view was used last). The view names inside the store are unchanged (`whole` is Surface).
- **New fields:** `lastInteriorView`, `selectedFeatureId`, `featureSeq` (bumped by every `selectFeature(id)`, also for the same id, so the camera turns to it again) and `featureListOpen`.
- **Rules:** choosing an interior view remembers it and drops the feature and the list; `setView('whole')` keeps them and clears the layer. `selectFeature(id)` forces Surface and clears the layer; `selectFeature(null)` only clears the id. `toggleFeatureList(true)` from Interior also goes to Surface. `enter` and `leave` reset everything (`featureSeq` is kept). `clearFeatureOnEmptyClick()` clears the feature in Explore only.
- **Esc order (`hotkeys.ts`):** the chart, the layer card, the feature card, the feature list, then Explore.
- **URL:** `view=surface|exploded|section`, with `view=whole` kept as an alias of `surface`; `feature=<id>` (a slug, `^[a-z0-9-]+$`) is applied after `view` through `selectFeature`, so a feature forces Surface. Both need `explore=1` and a valid target.
- **`useRadarShown()` (`viewStore.ts`):** `venusRadar`, or Explore active on Venus on Surface. The Venus materials use it; nothing writes `venusRadar` for Explore.
