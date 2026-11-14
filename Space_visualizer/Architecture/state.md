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
