---
title: 0002 React Three Fiber
tags: [decision]
---

# 0002 React Three Fiber

Back to [[Home]] · Date: 2026-10-04 · Status: accepted

## Context
The app is interface-heavy (info panel, filters, search, time controls, view switching) on top of a 3D scene, and it must grow to stars and galaxies later.

## Decision
React with React Three Fiber (R3F) and drei over Three.js, with Zustand for shared state. Hot paths (bulk point clouds in M4, custom shaders) drop down to plain Three.js.

## Consequences
- Interface and scene share one component and state model.
- R3F frame ordering matters: see [[scene]] for the priorities, including the drei `<Html>` label issue fixed in M1.
- Rejected alternatives: plain Three.js (too much hand-written glue between interface and scene), CesiumJS (built around Earth), Babylon.js (smaller ecosystem for this kind of work).
