---
title: 0006 WebP tiers, KTX2 deferred
tags: [decision]
---

# 0006 WebP tiers, KTX2 deferred

Back to [[Home]] · Spec: [[2026-10-04-m2-cinematic-and-rich-bodies-design]] · Date: 2026-10-04 · Status: accepted

## Context
Official products are large (up to about 2.1 GB per file, about 5 GB cached). The app must ship small textures, yet allow sharper ones locally.

## Decision
- Textures are built into WebP tiers: 1k (1024x512) and 2k (2048x1024) are committed under `public/textures/` (budget 60 MB; the validator fails the build above it; about 13.1 MB at the end of M2a.1). The 4k and 8k tiers are built locally by `npm run textures:hd` and git-ignored, except the sky's `color_4k.webp`, which is committed.
- Colour layers use WebP quality 90; normal maps, masks and ring profiles use lossless WebP.
- A missing tier falls back to the next lower one.
- KTX2/Basis compression is deferred until M7 deployment, when GPU memory on phones matters.

## Consequences
- WebP decodes to full RGBA in GPU memory, so each texture costs more memory than KTX2 would. This is acceptable for the 2k default.
- The pipeline needs no WASM Basis encoder.
- Revisit at M7 with measured phone memory use.
