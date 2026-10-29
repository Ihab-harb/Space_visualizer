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
- **`system.ts`:** `systemState(bodies, tables, jd)` returns every body's heliocentric state. A planet with a satellite is not drawn at the barycentre. With `mu = m_moon / (m_earth + m_moon)`, the planet sits at the barycentre minus `mu` times the geocentric offset, and the satellite at the planet plus the offset. At a table edge the position switches to mean elements without blending (a real jump; the result carries `tableId`). `bodyState` now throws for a satellite: callers use `systemState`.
- **`phase.ts`:** `moonPhase(sunKm, earthKm, moonKm)` gives the phase angle, illuminated fraction, waxing flag and name (used by the Phase chip and to find the golden-view dates).
- **Satellite orbit:** the catalogue `orbit` is a union. A satellite orbit carries the table file and its range, the mean elements, `mu`, and the `horizonsCheck` and `meanElementsCheck` figures. Earth gains a `centreCheck` (its position against the Horizons Earth centre).
