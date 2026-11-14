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
| `ephemeris/` | Kepler solver, conic geometry, JPL approximate planet positions, body-state dispatch, validity status | `solveKeplerElliptic`, `planetApproxState`, `selectTable`, `elementsAt`, `bodyState`, `validityStatus` |
| `frames/` | IAU rotation models → body orientation; ecliptic ↔ equatorial | `orientationAngles`, `bodyFixedToEcliptic`, `poleEcliptic` |
| `catalog/` | Data schemas, fact definitions, source-reference checks, the `Catalog` object | `BodySchema`, `FACT_KEYS`, `FACT_DEFS`, `findUnresolvedSources`, `createCatalog` |
| `regions/` | Region opacity by camera distance, nested region origins | `regionOpacity`, `regionVisibility` |
| `details/` | The cited per-body details model (M2b.1): interior layers, atmosphere, magnetic field, missions, discovery, named features. `checkDetails` returns every violated rule | `BodyDetailsSchema`, `InteriorLayerSchema`, `MagnetosphereSchema`, `MissionSchema`, `FeaturesSchema`, `checkDetails` |
| `units.ts` | Exact constants: AU, c, J2000, J2000 obliquity | `AU_KM`, `J2000_JD` |

Accuracy is tested against committed JPL Horizons vectors (see [[JPL Horizons]], [[0004-measured-accuracy]]).
