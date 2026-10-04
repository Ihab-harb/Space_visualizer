---
title: 0004 Show measured accuracy
tags: [decision]
---

# 0004 Show measured accuracy

Back to [[Home]] · Date: 2026-10-04 · Status: accepted

## Context
While planning M1, the JPL approximate elements were compared with JPL Horizons (DE441, system barycentres) at 9 dates per planet. Every planet stayed within about 1.6× JPL's published nominal error, except **Neptune with Table 1 (1800–2050)**: up to about 4.5× in direction (45″ against 10″ nominal) and about 7× in distance (1.42 million km against 200 000 km nominal).

## Decision
- The pipeline measures every orbit table against the committed Horizons reference and stores the result (`horizonsCheck`).
- The info panel shows the measured figure next to JPL's nominal one.
- Tests allow 3× nominal error, with a documented 10× override for Neptune/Table 1.

## Consequences
- Users see honest accuracy figures, not only the published ones.
- Refreshing the reference (`npm run horizons:reference`) updates the measured numbers on the next `npm run data`.
