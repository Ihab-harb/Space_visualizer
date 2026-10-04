---
title: 0003 Floating origin and logarithmic depth
tags: [decision]
---

# 0003 Floating origin and logarithmic depth

Back to [[Home]] · Date: 2026-10-04 · Status: accepted

## Context
GPUs compute in 32-bit floats (about 7 significant digits). At distances of AU and beyond, that precision gives visible jitter, and an ordinary depth buffer cannot span 1 m to galactic distances.

## Decision
- All positions are float64 in `src/core`.
- The Three.js camera stays at (0,0,0); every object is placed at `position − cameraPosition` each frame, so the GPU only sees small offsets.
- `logarithmicDepthBuffer` is enabled; the camera's near/far is 1 m to 10¹³ km for the Solar System region.

## Consequences
- No jitter from a moon's surface to the edge of the Solar System; the same scheme extends to galaxy scales.
- Every object (including orbit lines) must be repositioned every frame; frame ordering matters (see [[Overview]]).
