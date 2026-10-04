---
title: Architecture overview
tags: [architecture]
---

# Architecture overview

Back to [[Home]] · Spec: [[2026-10-04-solar-system-visualizer-design]]

**Data flow:** official sources → [[pipeline]] → `public/data/*.json` (committed) → `loadCatalog` ([[state]]) → `Catalog` → body positions each frame ([[core]]) → floating-origin rendering ([[scene]]) seen through a controller ([[camera]]), with panels in [[ui]].

**Frames and units:** heliocentric ecliptic J2000, km, float64, everywhere in `src/core`. Three.js world axes are the same frame (z = ecliptic north). The Three.js camera is always at (0,0,0); every frame, objects are placed at `position − cameraPosition` (see [[0003-floating-origin-and-log-depth]]).

**Time:** `jdTdb` (Julian Date, TDB) lives in `timeStore`; the UI shows UTC (UT before 1972).

**Frame order (`useFrame` priority):**
1. −2 `FrameDriver`: advances time, computes positions and orientations.
2. −1 `CameraSystem`: computes the camera pose.
3. −0.5 `BodyMesh`: places bodies (must run before drei labels).
4. 0: labels, orbit lines, light.

**Regions:** `regions.json` lists nested regions; only `solar-system` exists in M1. `regionManager` computes fade-in and fade-out by camera distance, ready for the Stellar Neighbourhood.
