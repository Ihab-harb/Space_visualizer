---
title: core
tags: [architecture]
---

# core (`src/core`)

Back to [[Home]] · [[Overview]]

Pure TypeScript. **No React, Three.js or Zustand imports**; the only library allowed is `zod`, for schemas.

| Folder | What it does | Key exports |
|---|---|---|
| `math/` | Vectors (`Vec3`), row-major 3×3 matrices (`Mat3`, passive `rotX`/`rotZ`), angle helpers | `add`, `sub`, `angleBetween`, `slerpDirection`, `mul`, `transpose`, `DEG`, `ARCSEC` |
| `time/` | Calendar ↔ JD (mixed Julian/Gregorian, Meeus), leap seconds, ΔT, UTC ↔ TDB, date formatting and parsing | `calendarToJd`, `jdToCalendar`, `utcToTdb`, `tdbToUtc`, `formatUtc`, `parseDateInput` |
| `ephemeris/` | Kepler solver, conic geometry, JPL approximate planet positions, body-state dispatch, validity status; M2b.2 adds Chebyshev tables, satellite mean elements, `systemState` and Moon phase (see below) | `solveKeplerElliptic`, `planetApproxState`, `selectTable`, `elementsAt`, `bodyState`, `validityStatus`, `evaluateChebyshev`, `systemState`, `moonPhase` |
| `frames/` | IAU rotation models → body orientation; ecliptic ↔ equatorial | `orientationAngles`, `bodyFixedToEcliptic`, `poleEcliptic` |
| `catalog/` | Data schemas, fact definitions, source-reference checks, the `Catalog` object | `BodySchema`, `FACT_KEYS`, `FACT_DEFS`, `findUnresolvedSources`, `createCatalog` |
| `regions/` | Region opacity by camera distance, nested region origins | `regionOpacity`, `regionVisibility` |
| `details/` | The cited per-body details model (M2b.1): interior layers, atmosphere, magnetic field, missions, discovery, named features. `checkDetails` returns every violated rule | `BodyDetailsSchema`, `InteriorLayerSchema`, `MagnetosphereSchema`, `MissionSchema`, `FeaturesSchema`, `checkDetails` |
| `units.ts` | Exact constants: AU, c, J2000, J2000 obliquity | `AU_KM`, `J2000_JD` |

Accuracy is tested against committed JPL Horizons vectors (see [[JPL Horizons]], [[0004-measured-accuracy]]).

## The Moon (M2b.2)
Built in [[2026-10-29-m2b2-moon]] from spec [[2026-10-29-m2b2-moon-design]]. Decision: [[0008-moon-chebyshev-table]].
- **`chebyshev.ts`:** `evaluateChebyshev(file, jd)` (Clenshaw, position only) and `chebyshevRange(file)`. The file shape is `ChebyshevFileSchema` in `catalog/schema.ts`: equal-length segments, one coefficient set per axis, geocentric ecliptic J2000 kilometres, TDB.
- **`meanElements.ts`:** the JPL satellite mean elements become a geocentric position in the ecliptic frame. Used only outside the Chebyshev table. Its error is measured and shown (about 175 degrees at the far dates).
- **`system.ts`:** `systemState(bodies, tables, jd)` returns every body's heliocentric state. A planet with a satellite is not drawn at the barycentre. With `mu = m_moon / (m_earth + m_moon)`, the planet sits at the barycentre minus `mu` times the geocentric offset, and the satellite at the planet plus the offset. At a table edge the position switches to mean elements without blending (a real jump: 72,806 km, 10.4 degrees, at 1800-01-01 and 54,582 km, 7.2 degrees, at the 2051 edge; the result carries `tableId`). `validityStatus` returns `'out-of-range'` for a satellite outside its table. `satelliteOrbitPathKm` samples the orbit line with the one model in force at the date. `bodyState` now throws for a satellite: callers use `systemState`.
- **`phase.ts`:** `moonPhase(sunKm, earthKm, moonKm)` gives the illuminated fraction, the waxing flag and the phase name (used by the Phase chip and to find the golden-view dates).
- **Satellite orbit:** the catalogue `orbit` is a union. A satellite orbit carries the table file and its range, the mean elements, `mu`, and the `table.horizonsCheck` and `meanElements.horizonsCheck` figures. Earth gains a `centreCheck` (its position against the Horizons Earth centre).

## Explore interior (M2b.3)
Built in [[2026-10-30-m2b3-explore-interior]] from spec [[2026-10-30-m2b3-explore-interior-design]]. Decision: [[0009-peer-reviewed-papers-for-estimates]].
- **Details schema (`details/schema.ts`):** `InteriorLayerSchema` is a union. A cited layer has both radius bounds, `sizeKind` `cited` or `estimate` (absent means cited) and an optional `estimate` flag. An illustrative layer has `sizeKind: 'illustrative'` and optional bounds (both or none). `estimate: true` means a value of the layer (size, state or composition) comes from a peer-reviewed paper. A layer sized as an estimate must have `estimate: true`.
- **`resolveLayerRanges(layers, radiusKm)` (`details/checks.ts`):** the one way to read a layer's bounds. Consumers must not read the bounds directly, because an illustrative layer has none. A run of bound-less layers shares the room evenly between the inner edge of the cited layer above (the surface if none) and the outer edge of the cited layer below (the centre if none). `checkDetails` keeps every older rule over the resolved ranges and adds: an illustrative layer must have room between its neighbours, and a layer has both bounds or none. An interior made only of illustrative layers is allowed.
- **`interior/geometry.ts`:** pure geometry for the cutaway. `drawnLayers(layers, bodyRadiusKm)` returns shells outside in as fractions of the radius (`outer`, `inner`, soft band widths where a bound is a range, `thickened`, `sizeKind`, `state`). A range is drawn at its midpoint with a soft band. The layers tile the radius: a shared boundary is drawn where the layer above ends, so a small gap the sources leave (within the check tolerance; Mars core top 1,800 km against the mantle's 1,829.5 km) does not show as a seam. A layer thinner than 1.2 % of the radius is thickened by moving its inner bound inward (never past the layers below) and flagged. `explodeOffsets(layers, progress)` gives each layer's lift along the explode axis. `sectionVisible(view, progress)` says whether a cut is on and how far the layers are exploded.
- **Gradual boundaries (review fix wave):** a layer may carry `gradual: { sourceId }`: its outer boundary has no sharp edge (Jupiter's dilute core, Saturn's diffuse core), cited to the sentence that says so. `drawnLayers` gives such a layer `gradual: true` and a soft band of `GRADUAL_BAND` 0.12 R (illustrative width, never wider than either layer it joins; a wider cited range keeps its own band) on both sides of the boundary. `checkDetails` rejects `gradual` on the outermost layer (its outer edge is the surface).
- **Layer count and radius:** `MAX_INTERIOR_LAYERS` 8 is the most the cutaway's shaders hold; `checkDetails` fails a file with more. `interior.radiusKm` (`{ value, sourceId }`) records the cited mean radius the build converted depth and percent bounds with; `checkDetails` checks it equals the build's radius. The depth ruler uses it.
- **Explode spacing (tuned in Task 8):** each cap lifts clear of the dome below it: `EXPLODE_REVEAL` 0.8 of that dome's height shows, plus `EXPLODE_MARGIN` 0.08 R. The innermost sphere stays put. The outermost shell lifts at most `EXPLODE_MAX` 1.8 R in total; past that the spacing shrinks evenly. Earth's offsets are 1.66, 0.79, 0.27 and 0 R. The first rule was a flat 0.3 R step capped at 0.8 R.
